import assert from "node:assert/strict";
import test from "node:test";
import { engineForUrl, isSearchPage, normalizeSearxOrigins } from "../src/engines.js";
import { createConnectionRouter } from "../src/connections.js";
import { LinkdingApi } from "../src/linkding.js";
import { ReadeckApi } from "../src/readeck.js";
import { requestJson } from "../src/network.js";

function event() {
  const listeners = [];
  return { addListener(fn) { listeners.push(fn); }, async emit(value) { await Promise.all(listeners.map((fn) => fn(value))); } };
}
function port(name, sender) {
  return { name, sender, messages: [], onMessage: event(), onDisconnect: event(),
    postMessage(message) { this.messages.push(structuredClone(message)); },
    disconnect() { if (this.closed) return; this.closed = true; this.onDisconnect.emit(); },
  };
}

function fixture(t) {
  const runtime = { id: "extension-id", getURL: (path) => `chrome-extension://extension-id/${path}` };
  const config = { searxOrigins: ["https://approved.example"] };
  const tabs = new Map([[1, "https://approved.example/search?q=private"], [2, "https://attacker.example/search?q=private"]]);
  let searches = 0;
  const router = createConnectionRouter({ runtime, getConfiguration: async () => config,
    getTab: async (id) => ({ url: tabs.get(id) }),
    search: async (port, request) => { searches++; port.postMessage({ privateResult: request.searchTerm }); },
    openOptions() {},
  });
  const ports = [];
  t.after(() => { router.invalidate(); for (const p of ports) p.disconnect(); });
  function connect(name, tabId, frameId, url) {
    const p = port(name, { id: runtime.id, tab: { id: tabId }, frameId, url });
    ports.push(p); router.connected(p); return p;
  }
  async function prepare(tabId = 1, frameId = 0) {
    const p = connect("search-controller", tabId, frameId, tabs.get(tabId));
    await p.onMessage.emit({ action: "prepare", url: tabs.get(tabId) });
    await p.onMessage.emit({ action: "start", searchTerm: "private" });
    return p;
  }
  return { runtime, config, tabs, router, connect, prepare, get searches() { return searches; } };
}

test("only exact public engine hosts and explicitly approved origins are authorized", () => {
  for (const url of ["https://evil.example/search", "https://google.evil/search", "https://evilgoogle.com/search",
    "https://duckduckgo.com.evil/search", "https://mail.google.com/search", "https://www.google.com:8443/search"]) {
    assert.equal(engineForUrl(url), null, url);
  }
  assert.equal(engineForUrl("https://www.google.co.in/search?q=hi"), "google");
  assert.equal(engineForUrl("https://approved.example:8443/search", ["https://approved.example"]), null);
  assert.equal(engineForUrl("https://approved.example/search", ["https://approved.example"]), "searx");
  assert.equal(isSearchPage("https://www.google.com/maps?q=hi", "google"), false);
  assert.equal(isSearchPage("https://approved.example/prefix/search", "searx"), true);
  assert.deepEqual(normalizeSearxOrigins(["https://APPROVED.example/prefix/", "https://approved.example"]), ["https://approved.example"]);
  assert.throws(() => normalizeSearxOrigins(["http://approved.example"]));
});

test("arbitrary /search pages, subframes and standalone embedded results cannot initiate searches", async (t) => {
  const f = fixture(t);
  assert.equal((await f.prepare(2)).closed, true);
  assert.equal((await f.prepare(1, 4)).closed, true);
  const iframe = f.connect("results-frame", 2, 4, f.runtime.getURL("results/index.html"));
  await iframe.onMessage.emit({ action: "attach", channel: "invented", searchTerm: "private" });
  assert.equal(iframe.closed, true);
  assert.equal(f.searches, 0);
});

test("private results go only to the bound iframe, not the controller or another tab", async (t) => {
  const f = fixture(t);
  const controller = await f.prepare();
  const channel = controller.messages.find((m) => m.action === "frame").channel;
  const otherTab = f.connect("results-frame", 2, 5, f.runtime.getURL("results/index.html"));
  await otherTab.onMessage.emit({ action: "attach", channel });
  assert.equal(otherTab.closed, true);
  assert.equal(f.searches, 0);
  const iframe = f.connect("results-frame", 1, 5, f.runtime.getURL("results/index.html"));
  await iframe.onMessage.emit({ action: "attach", channel });
  assert.equal(f.searches, 1);
  assert.equal(iframe.messages.at(-1).privateResult, "private");
  assert.equal(JSON.stringify(controller.messages).includes("private"), false);
  const replay = f.connect("results-frame", 1, 6, f.runtime.getURL("results/index.html"));
  await replay.onMessage.emit({ action: "attach", channel });
  assert.equal(replay.closed, true);
  assert.equal(f.searches, 1);
});

test("navigation and permission revocation invalidate pending iframe authority", async (t) => {
  const f = fixture(t);
  const controller = await f.prepare();
  const channel = controller.messages.at(-1).channel;
  f.tabs.set(1, "https://attacker.example/search?q=private");
  const iframe = f.connect("results-frame", 1, 4, f.runtime.getURL("results/index.html"));
  await iframe.onMessage.emit({ action: "attach", channel });
  assert.equal(f.searches, 0);
  f.router.invalidate();
  assert.equal(controller.closed, true);
  assert.equal(controller.messages.at(-1).action, "revoked");
});

test("client-side URL changes work despite stale sender.url, but stale search URLs do not", async (t) => {
  const f = fixture(t);
  const originalUrl = f.tabs.get(1);
  const nextUrl = "https://approved.example/search?q=next";
  f.tabs.set(1, nextUrl);
  const controller = f.connect("search-controller", 1, 0, originalUrl);
  await controller.onMessage.emit({ action: "prepare", url: nextUrl });
  await controller.onMessage.emit({ action: "start", searchTerm: "next" });
  const iframe = f.connect("results-frame", 1, 4, f.runtime.getURL("results/index.html"));
  await iframe.onMessage.emit({ action: "attach", channel: controller.messages.at(-1).channel });
  assert.equal(iframe.messages.at(-1).privateResult, "next");
  const stale = f.connect("search-controller", 1, 0, originalUrl);
  await stale.onMessage.emit({ action: "prepare", url: originalUrl });
  assert.equal(stale.closed, true);
});

test("both providers reject insecure URLs and embedded credentials before fetching", () => {
  for (const Api of [LinkdingApi, ReadeckApi]) {
    for (const baseUrl of ["http://example.org", "https://token@example.org", "file:///private"]) {
      assert.throws(() => new Api({ baseUrl, token: "secret" }), /HTTPS/);
    }
  }
});

test("request deadlines cover headers and body, abort fetch, and prohibit redirects", async () => {
  let options;
  await assert.rejects(requestJson(async (_url, opts) => {
    options = opts;
    return { status: 200, json: () => new Promise(() => {}) };
  }, "https://example.org", {}, 5), /timed out/);
  assert.equal(options.signal.aborted, true);
  assert.equal(options.redirect, "error");
  assert.equal(options.credentials, "omit");
  await assert.rejects(requestJson(() => new Promise(() => {}), "https://example.org", {}, 5), /timed out/);
});
