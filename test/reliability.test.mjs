import assert from "node:assert/strict";
import test from "node:test";
import { createSearchHandler } from "../src/search.js";
import { normalizeConfiguration, saveConfiguration } from "../src/configuration.js";
import { registerSearxScripts } from "../src/registration.js";
import { findSidebar, waitForSidebar } from "../src/placement.js";

const config = normalizeConfiguration({
  linkding: { enabled: true, baseUrl: "https://links.example", token: "secret-link" },
  readeck: { enabled: true, baseUrl: "https://read.example", token: "secret-read" },
});
const found = { results: [{ title: "Healthy result" }], total: 1 };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const receiver = () => ({ messages: [], postMessage(m) { this.messages.push(structuredClone(m)); } });

test("healthy results arrive before a stalled provider times out", async () => {
  const port = receiver();
  const search = createSearchHandler({ getConfiguration: async () => config,
    makeLinkding: () => ({ search: async () => found }),
    makeReadeck: () => ({ search: () => new Promise(() => {}) }), timeoutMs: 30,
  });
  const complete = search(port, { searchTerm: "test" });
  await tick();
  assert.equal(port.messages.at(-1).providers[0].results[0].title, "Healthy result");
  assert.equal(port.messages.at(-1).done, false);
  await complete;
  assert.equal(port.messages.at(-1).done, true);
  assert.match(port.messages.at(-1).warnings[0], /Readeck/);
});

test("constructor failure is isolated and never forwards arbitrary error strings", async () => {
  const port = receiver();
  const search = createSearchHandler({ getConfiguration: async () => config,
    makeLinkding: () => ({ search: async () => found }),
    makeReadeck: () => { throw new Error("secret-read"); },
  });
  await search(port, { searchTerm: "test" });
  assert.equal(port.messages.at(-1).providers.length, 1);
  assert.equal(JSON.stringify(port.messages).includes("secret-"), false);
});

test("bookmark results are delivered before annotations, and survive enrichment timeout", async () => {
  const port = receiver();
  const search = createSearchHandler({ getConfiguration: async () => config,
    makeLinkding: () => ({ search: async () => found }),
    makeReadeck: () => ({ search: async () => found, enrichAnnotations: () => new Promise(() => {}) }),
    enrichmentTimeoutMs: 30,
  });
  const complete = search(port, { searchTerm: "test" });
  await tick();
  assert.equal(port.messages.at(-1).providers.length, 2);
  assert.equal(port.messages.at(-1).done, false);
  await complete;
  assert.equal(port.messages.at(-1).providers.length, 2);
  assert.match(port.messages.at(-1).warnings[0], /highlights/);
});

test("blank queries do not search providers or enumerate bookmarks", async () => {
  let configurationRead = false;
  const handler = createSearchHandler({ getConfiguration: () => { configurationRead = true; } });
  await handler(receiver(), { searchTerm: "  " });
  assert.equal(configurationRead, false);
});

test("saving disabled or unavailable providers needs no connection test", async () => {
  let saved;
  const storage = { set(values, callback) { saved = JSON.parse(values.ld_ext_config); callback(); } };
  await saveConfiguration(normalizeConfiguration(), storage);
  assert.equal(saved.linkding.enabled, false);
  assert.equal(saved.readeck.enabled, false);
  await saveConfiguration({ ...config, searxOrigins: ["https://search.example/prefix"] }, storage);
  assert.equal(saved.linkding.enabled, true);
  assert.deepEqual(saved.searxOrigins, ["https://search.example"]);
  assert.throws(() => saveConfiguration({ ...config, linkding: { ...config.linkding, baseUrl: "http://example.org" } }, storage), /HTTPS/);
});

test("SearX registration adds, updates and removes only approved hostname matches", async () => {
  let registered = [];
  const scripting = {
    async getRegisteredContentScripts() { return registered; },
    async registerContentScripts(scripts) { registered = scripts; },
    async updateContentScripts(scripts) { registered = scripts; },
    async unregisterContentScripts() { registered = []; },
  };
  await registerSearxScripts(scripting, { searxOrigins: ["https://search.example:8443"] });
  assert.deepEqual(registered[0].matches, ["https://search.example/*"]);
  assert.deepEqual(registered[0].js, ["build/searchInjection.js"]);
  await registerSearxScripts(scripting, { searxOrigins: ["https://other.example"] });
  assert.deepEqual(registered[0].matches, ["https://other.example/*"]);
  await registerSearxScripts(scripting, { searxOrigins: [] });
  assert.deepEqual(registered, []);
});

test("missing Google containers fail quietly; sidebar wait expires and disconnects", async () => {
  let disconnected = false;
  const original = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() { disconnected = true; }
  };
  try {
    const document = { querySelector: () => null, documentElement: {} };
    assert.equal(findSidebar(document, "google"), null);
    const result = await waitForSidebar(document, "qwant", new AbortController().signal, 5);
    assert.equal(result, null);
    assert.equal(disconnected, true);
  } finally { globalThis.MutationObserver = original; }
});
