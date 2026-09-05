import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LinkdingApi } from "../src/linkding.js";
import { ReadeckApi } from "../src/readeck.js";

async function response(name) {
  const fixture = JSON.parse(await readFile(new URL(`fixtures/providers/${name}.json`, import.meta.url), "utf8"));
  return new Response(JSON.stringify(fixture.body), { status: fixture.status, headers: fixture.headers });
}

test("Linkding 1.46.2 responses preserve populated bookmarks and handle real null/empty metadata", async () => {
  const api = new LinkdingApi({ baseUrl: "https://links.example/library/", token: "fixture-token" }, async (url, options) => {
    assert.equal(url, "https://links.example/library/api/bookmarks/?q=contract&limit=10");
    assert.equal(options.headers.Authorization, "Token fixture-token");
    return response("linkding-1.46.2-search");
  });
  const found = await api.search("contract", { limit: 10 });
  assert.equal(found.total, 2);
  assert.deepEqual(found.results, [
    {
      url: "https://example.org/contract-minimal", title: "https://example.org/contract-minimal",
      description: "", tags: [], note: "", annotations: [],
      savedUrl: "https://web.archive.org/web/20260101000000/https://example.org/contract-minimal",
    },
    {
      url: "https://example.org/contract-populated", title: "Contract populated bookmark",
      description: "A fixture description & details", tags: ["contract", "research"], note: "", annotations: [],
      savedUrl: "https://web.archive.org/web/20260101000000/https://example.org/contract-populated",
    },
  ]);
});

test("Readeck 0.23.2 read-only responses retain bookmark notes, labels, highlights and annotation notes", async () => {
  const api = new ReadeckApi({ baseUrl: "https://read.example/library/", token: "read-only-fixture" }, async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer read-only-fixture");
    if (url.endsWith("/annotations")) {
      assert.equal(url, "https://read.example/library/api/bookmarks/bookmarkPopulated00001/annotations");
      return response("readeck-0.23.2-annotations");
    }
    assert.equal(url, "https://read.example/library/api/bookmarks?search=contract&limit=10");
    return response("readeck-0.23.2-search");
  });
  const found = await api.search("contract");
  assert.equal(found.total, 2);
  assert.deepEqual(found.results, [
    {
      id: "bookmarkPopulated00001", url: "https://example.org/contract-populated",
      savedUrl: "https://read.example/library/bookmarks/bookmarkPopulated00001",
      title: "Contract populated bookmark", description: "A fixture description & details",
      tags: ["contract", "research"], note: "Contract bookmark note", annotations: [],
    },
    {
      id: "bookmarkMinimal0000002", url: "https://example.org/contract-minimal",
      savedUrl: "https://read.example/library/bookmarks/bookmarkMinimal0000002",
      title: "https://example.org/contract-minimal", description: "", tags: [], note: "", annotations: [],
    },
  ]);
  const enriched = await api.enrichAnnotations([found.results[0]], "contract");
  assert.deepEqual(enriched[0].annotations, [{ text: "Contract highlight text", note: "Contract annotation note" }]);
});

for (const [name, Api] of [["linkding-1.46.2", LinkdingApi], ["readeck-0.23.2", ReadeckApi]]) {
  test(`${name} pagination retains the server total rather than the displayed page length`, async () => {
    const api = new Api({ baseUrl: "https://service.example/prefix", token: "fixture" }, () => response(`${name}-page`));
    const found = await api.search("contract", { limit: 1 });
    assert.equal(found.total, 2);
    assert.equal(found.results.length, 1);
  });
  test(`${name} authentication failures reject searches and fail connection tests`, async () => {
    const api = new Api({ baseUrl: "https://service.example/prefix", token: "invalid-fixture" }, () => response(`${name}-unauthorized`));
    await assert.rejects(api.search("contract"), /HTTP 401/);
    const connection = await api.testConnection();
    assert.equal(connection.success, false);
    assert.equal(connection.status, 401);
    assert.equal(JSON.stringify(connection).includes("invalid-fixture"), false);
  });
}

