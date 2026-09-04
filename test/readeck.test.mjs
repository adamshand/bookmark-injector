import assert from "node:assert/strict";
import test from "node:test";

import { ReadeckApi } from "../src/readeck.js";

function response(body, { status = 200, headers = {} } = {}) {
  return {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers(headers),
    async json() {
      return body;
    },
  };
}

test("Readeck search returns normalized bookmarks and the server total", async () => {
  const requests = [];
  const api = new ReadeckApi(
    { baseUrl: "https://read.example/", token: "read-only-token" },
    async (url, options) => {
      requests.push({ url, options });
      return response(
        [
          {
            id: "abcdefghijklmnopqr",
            url: "https://example.com/article",
            title: "A useful article",
            description: "A short summary",
            labels: ["research", "rust"],
            note: "Bookmark note",
          },
        ],
        { headers: { "Total-Count": "37" } },
      );
    },
  );

  const found = await api.search("borrow checker & types", { limit: 10 });

  assert.deepEqual(found, {
    total: 37,
    results: [
      {
        id: "abcdefghijklmnopqr",
        url: "https://example.com/article",
        savedUrl: "https://read.example/bookmarks/abcdefghijklmnopqr",
        title: "A useful article",
        description: "A short summary",
        tags: ["research", "rust"],
        note: "Bookmark note",
        annotations: [],
      },
    ],
  });
  assert.equal(
    requests[0].url,
    "https://read.example/api/bookmarks?search=borrow+checker+%26+types&limit=10",
  );
  assert.equal(requests[0].options.headers.Authorization, "Bearer read-only-token");
});

test("the default browser fetch keeps its required global receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = function (_url, _options) {
    assert.equal(this, globalThis);
    return Promise.resolve(response([]));
  };
  try {
    const api = new ReadeckApi({
      baseUrl: "https://read.example",
      token: "private-token",
    });
    assert.equal((await api.testConnection()).success, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("connection testing uses a Bearer token without returning it", async () => {
  let authorization;
  const api = new ReadeckApi(
    { baseUrl: "https://read.example", token: "private-token" },
    async (_url, options) => {
      authorization = options.headers.Authorization;
      return response([]);
    },
  );

  const result = await api.testConnection();

  assert.equal(authorization, "Bearer private-token");
  assert.deepEqual(result, {
    success: true,
    status: 200,
    message: "Connection successful",
  });
  assert.equal(JSON.stringify(result).includes("private-token"), false);
});

test("annotation enrichment is bounded, concurrent, and cached", async () => {
  let active = 0;
  let maximumActive = 0;
  const requested = [];
  const configuration = { baseUrl: "https://read.example", token: "read-only-token" };
  const fetcher = async (url) => {
    requested.push(url);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    const id = url.split("/").at(-2);
    return response([
      {
        id: `note-${id}`,
        text: `Highlighted ${id}`,
        note: `A note about ${id}`,
        color: "yellow",
      },
    ]);
  };
  const api = new ReadeckApi(configuration, fetcher);
  const results = Array.from({ length: 12 }, (_, index) => ({
    id: `bookmark-${index}`,
    annotations: [],
  }));

  const enriched = await api.enrichAnnotations(results);
  await new ReadeckApi(configuration, fetcher).enrichAnnotations(results);

  assert.equal(requested.length, 10, "more than ten bookmark annotation lists were fetched");
  assert.ok(maximumActive <= 3, `used ${maximumActive} concurrent annotation requests`);
  assert.deepEqual(enriched[0].annotations, [
    {
      text: "Highlighted bookmark-0",
      note: "A note about bookmark-0",
    },
  ]);
  assert.deepEqual(enriched[10].annotations, []);
});
