import assert from "node:assert/strict";
import test from "node:test";

import { LinkdingApi } from "../src/linkding.js";

test("Linkding search normalizes bookmarks and retains the server total", async () => {
  const api = new LinkdingApi(
    { baseUrl: "https://links.example/", token: "link-token" },
    async () => ({
      status: 200,
      async json() {
        return {
          count: 42,
          results: [
            {
              url: "https://example.com",
              title: "Example",
              description: "Description",
              tag_names: ["reference"],
              web_archive_snapshot_url: "https://links.example/archive/1",
            },
          ],
        };
      },
    }),
  );

  const found = await api.search("example", { limit: 10 });

  assert.deepEqual(found, {
    total: 42,
    results: [
      {
        url: "https://example.com",
        savedUrl: "https://links.example/archive/1",
        title: "Example",
        description: "Description",
        tags: ["reference"],
        note: "",
        annotations: [],
      },
    ],
  });
});
