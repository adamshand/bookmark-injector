"""Run inside the disposable Linkding container; never against a user's instance."""
import html
import json
import os
import re
import sys
import time

import django
import requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bookmarks.settings")
django.setup()
from django.contrib.auth.models import User
from bookmarks.models import ApiToken

ld_base = "http://localhost:9090"
rd_base = "http://" + sys.argv[1] + ":8000"
ld = requests.Session()
ld.headers["Authorization"] = "Token " + ApiToken.objects.get_or_create(user=User.objects.get(username="fixture"), name="contract-fixtures")[0].key

# Use Readeck's real user-facing token creation form. /api/auth was removed in
# 0.22; login/password handling here is fixture setup, not extension behavior.
web = requests.Session()
web.get(rd_base + "/login", timeout=10).raise_for_status()
web.post(rd_base + "/login", data={"username": "fixture", "password": "fixture-password"},
         headers={"Origin": rd_base, "Referer": rd_base + "/login"}, timeout=10).raise_for_status()
created = web.post(rd_base + "/profile/tokens", data={},
                   headers={"Origin": rd_base, "Referer": rd_base + "/profile/tokens"}, timeout=10)
created.raise_for_status()
token = html.unescape(re.search(r'data-clipboard-target="content" value="([^"]+)"', created.text)[1])
token_url = created.url
web.post(token_url, data={"application": "contract-fixtures", "is_enabled": "t",
         "roles": ["bookmarks:read", "bookmarks:write"]},
         headers={"Origin": rd_base, "Referer": token_url}, timeout=10).raise_for_status()
rd = requests.Session()
rd.headers["Authorization"] = "Bearer " + token

# Seed only invented content. Internal Docker networking denies internet access;
# supplying HTML lets Readeck extract an article without fetching a live website.
ld.post(ld_base + "/api/bookmarks/?disable_scraping&disable_html_snapshot", json={
    "url": "https://example.org/contract-populated", "title": "Contract populated bookmark",
    "description": "A fixture description & details", "tag_names": ["research", "contract"],
}, timeout=30).raise_for_status()
ld.post(ld_base + "/api/bookmarks/?disable_scraping&disable_html_snapshot", json={"url": "https://example.org/contract-minimal"}, timeout=30).raise_for_status()

rd_ids = []
for index, kind in enumerate(["populated", "minimal"]):
    payload = {
        "url": "https://example.org/contract-" + kind,
        "html": "<!doctype html><html><body><article><p>Contract highlight text. " +
                ("A sentence about bookmarks and saved articles. " * 20) + "</p></article></body></html>",
    }
    if kind == "populated":
        payload.update(title="Contract populated bookmark", labels=["research", "contract"])
    response = rd.post(rd_base + "/api/bookmarks", json=payload, timeout=10)
    response.raise_for_status()
    bookmark_id = response.headers["Bookmark-Id"]
    rd_ids.append(bookmark_id)
    for attempt in range(100):
        detail = rd.get(rd_base + "/api/bookmarks/" + bookmark_id, timeout=10).json()
        if detail["loaded"]:
            break
        time.sleep(0.1)
    else:
        raise RuntimeError("Readeck extraction did not finish")
    if kind == "populated":
        rd.patch(rd_base + "/api/bookmarks/" + bookmark_id,
                 json={"description": "A fixture description & details", "note": "Contract bookmark note"}, timeout=10).raise_for_status()

annotation_url = rd_base + "/api/bookmarks/" + rd_ids[0] + "/annotations"
response = rd.post(annotation_url, json={
    "start_selector": "section[1]/p[1]", "start_offset": 0,
    "end_selector": "section[1]/p[1]", "end_offset": 23, "color": "yellow",
}, timeout=10)
response.raise_for_status()
annotation_id = response.json()["id"]
rd.patch(annotation_url + "/" + annotation_id, json={"color": "yellow", "note": "Contract annotation note"}, timeout=10).raise_for_status()
# Captured reads really use a token restricted to bookmark read access.
web.post(token_url, data={"application": "contract-fixtures", "is_enabled": "t", "roles": ["bookmarks:read"]},
         headers={"Origin": rd_base, "Referer": token_url}, timeout=10).raise_for_status()
probe = rd.post(rd_base + "/api/bookmarks", json={
    "url": "https://example.org/should-not-be-created", "html": "<p>Permission probe</p>",
}, timeout=10)
if probe.status_code != 403:
    raise RuntimeError("Readeck fixture token still permits writes (expected HTTP 403)")

replacements = {
    ld_base: "https://links.example", rd_base: "https://read.example",
    rd_ids[0]: "bookmarkPopulated00001", rd_ids[1]: "bookmarkMinimal0000002",
    annotation_id: "annotationFixture00001",
}

def sanitize(value):
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, str):
        for old, new in replacements.items():
            value = value.replace(old, new)
        value = re.sub(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)", "2026-01-01T00:00:00Z", value)
        value = re.sub(r"(web\.archive\.org/web/)\d{14}/", r"\g<1>20260101000000/", value)
    return value


def capture(session, url, params=None):
    response = session.get(url, params=params, timeout=10, allow_redirects=False)
    return sanitize({
        "status": response.status_code,
        "headers": {key.lower(): value for key, value in response.headers.items()
                    if key.lower() in ["content-type", "cache-control", "total-count", "link"]},
        "body": response.json() if "application/json" in response.headers.get("Content-Type", "") else response.text,
    })

invalid = requests.Session()
invalid.headers.update(Authorization="Bearer invalid-fixture-token", Accept="application/json")

print(json.dumps({
    "linkding-1.46.2-search.json": capture(ld, ld_base + "/api/bookmarks/", {"q": "contract", "limit": 10}),
    "linkding-1.46.2-page.json": capture(ld, ld_base + "/api/bookmarks/", {"q": "contract", "limit": 1}),
    "linkding-1.46.2-unauthorized.json": capture(requests.Session(), ld_base + "/api/bookmarks/"),
    "readeck-0.23.2-search.json": capture(rd, rd_base + "/api/bookmarks", {"search": "contract", "limit": 10}),
    "readeck-0.23.2-page.json": capture(rd, rd_base + "/api/bookmarks", {"search": "contract", "limit": 1}),
    "readeck-0.23.2-annotations.json": capture(rd, annotation_url),
    "readeck-0.23.2-unauthorized.json": capture(invalid, rd_base + "/api/bookmarks"),
}, indent=2))
