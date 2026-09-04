import assert from "node:assert/strict";
import test from "node:test";

import { createSearchHandler, guardPort } from "../src/search.js";

function port() {
  return {
    messages: [],
    postMessage(message) {
      this.messages.push(message);
    },
  };
}

test("a tab entering back-forward cache closes quietly and receives no late result", () => {
  let disconnected;
  let observedLastError = false;
  const sent = [];
  const port = {
    onDisconnect: {
      addListener(listener) {
        disconnected = listener;
      },
    },
    postMessage(message) {
      sent.push(message);
    },
  };
  const runtime = {
    get lastError() {
      observedLastError = true;
      return { message: "The page keeping the extension port is moved into back/forward cache" };
    },
  };
  const guarded = guardPort(port, runtime);

  disconnected();
  guarded.postMessage({ results: ["too late"] });

  assert.equal(observedLastError, true);
  assert.deepEqual(sent, []);
});

test("configured providers search concurrently, fail independently, and answer their own tab", async () => {
  let releaseReadeck;
  const waitingForReadeck = new Promise((resolve) => {
    releaseReadeck = resolve;
  });
  const config = {
    linkding: { enabled: true, baseUrl: "https://links.example", token: "link-token" },
    readeck: {
      enabled: true,
      baseUrl: "https://read.example",
      token: "read-token",
      enrichAnnotations: false,
    },
    resultNum: 10,
  };
  const handler = createSearchHandler({
    getConfiguration: async () => config,
    makeLinkding: () => ({
      async search(term) {
        if (term === "broken") throw new Error("Linkding unavailable");
        return {
          total: 14,
          results: [
            {
              url: `https://link.example/${term}`,
              savedUrl: `https://archive.example/${term}`,
              title: `Linkding ${term}`,
              description: "From Linkding",
              tags: ["links"],
              note: "",
              annotations: [],
            },
          ],
        };
      },
    }),
    makeReadeck: () => ({
      async search(term) {
        await waitingForReadeck;
        return {
          total: 21,
          results: [{ title: `Readeck ${term}` }],
        };
      },
    }),
  });
  const first = port();
  const second = port();

  const firstSearch = handler(first, { searchTerm: "one" });
  const secondSearch = handler(second, { searchTerm: "broken" });
  releaseReadeck();
  await Promise.all([firstSearch, secondSearch]);

  assert.deepEqual(
    first.messages[0].providers.map((provider) => provider.source),
    ["linkding", "readeck"],
  );
  assert.equal(first.messages[0].providers[0].results[0].title, "Linkding one");
  assert.equal(
    first.messages[0].providers[0].results[0].savedUrl,
    "https://archive.example/one",
  );
  assert.equal(first.messages[0].providers[1].total, 21);
  assert.deepEqual(second.messages[0].providers.map((provider) => provider.source), ["readeck"]);
  assert.equal(second.messages[0].warnings[0], "Linkding unavailable");
  assert.equal(first.messages.length, 1);
  assert.equal(second.messages.length, 1);
  const messages = JSON.stringify([...first.messages, ...second.messages]);
  assert.equal(messages.includes("link-token"), false);
  assert.equal(messages.includes("read-token"), false);
});
