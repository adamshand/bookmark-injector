# Provider compatibility response fixtures

These are **actual HTTP responses**, not hand-written API examples. Captured on
2026-09-04 from disposable official containers seeded with invented `example.org`
bookmarks. No user's library, password, token, or cookies were captured.

| Provider | Version | Immutable image digest |
| --- | --- | --- |
| Linkding | [1.46.2](https://github.com/sissbruecker/linkding/releases/tag/v1.46.2) | `sissbruecker/linkding@sha256:0c0a9a04c7ebd644293c37f98710872fe7cdff0ea1ff7fd9be4d235e4c4678d2` |
| Readeck | [0.23.2](https://codeberg.org/readeck/readeck/releases/tag/0.23.2) | `codeberg.org/readeck/readeck@sha256:32bd82e457a3a9a3fffb161f55cfebf0fd7ffbc87ddf2fe7a321361905348f0a` |

## What was captured

- `*-search.json`: `GET /api/bookmarks[/]?q=contract&limit=10` for Linkding,
  or `?search=contract&limit=10` for Readeck. Each includes a populated bookmark
  and a minimally specified bookmark, preserving real empty strings and nulls.
- `*-page.json`: the same search with `limit=1`, including the server's total and
  pagination metadata. The fixture contains fewer results than the total.
- `readeck-*-annotations.json`: a real highlight and annotation note. Readeck
  extracted supplied HTML; no live article was fetched.
- `*-unauthorized.json`: Linkding without credentials, Readeck with an invalid
  Bearer token. Both return HTTP 401. Readeck without an authorization header may
  redirect to login instead, so that is not the captured authentication case.

Readeck fixture creation temporarily uses bookmark write access. Before any
captured successful GET, that same token is restricted to **`bookmarks:read`**;
a write probe must return HTTP 403 before capture can proceed.
The capture script uses the user-facing token form: `/api/auth` no longer exists
in this version. Linkding fixture setup uses its `ApiToken` model, not the legacy
DRF token table; the captured responses themselves come from the HTTP API.
Linkding seed requests use its documented `disable_scraping` and
`disable_html_snapshot` flags, avoiding live metadata lookups.

## Sanitization

The capture script:

- replaces container origins with `https://links.example` and `https://read.example`;
- substitutes stable Readeck bookmark/annotation IDs;
- normalizes timestamps, including Wayback URL timestamps;
- keeps only Content-Type, Cache-Control, Total-Count and Link response headers;
- preserves all JSON body keys and types, including fields the extension ignores.

The replay tests additionally configure client base URLs with a `/library` or
`/prefix` path and verify outgoing URLs. Those paths are client regression cases;
the capture servers themselves run at `/`.

## Regeneration (optional)

With Docker running:

```sh
node scripts/capture-provider-fixtures.mjs
```

This creates a uniquely named **internal** Docker network and two fresh containers,
with no host ports or host-directory mounts. Containers have no internet access;
only the initial image download needs network access. The script removes its own
containers, anonymous data volumes, and network on completion or failure.
Normal tests replay the committed responses and need neither Docker nor live services.

Review fixture diffs rather than blindly accepting them. For another provider
version, update the pinned image, filename/version references, and provenance
alongside independently checked expected behavior in `test/provider-contracts.test.mjs`.
Fixtures demonstrate compatibility with these versions, not every upstream release.
