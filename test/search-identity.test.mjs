import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { searchPageKey } from "../src/searchIdentity.js";
import { isSearchPage } from "../src/engines.js";
import { guardPort, isContextInvalidated } from "../src/browser.js";

test("search identity ignores tracking and fragments but preserves origin, route and query", () => {
  const original = searchPageKey("https://www.google.com/search?q=some+words");
  assert.equal(original, searchPageKey("https://www.google.com/search?sourceid=chrome&q=some%20words&sei=tracking#results"));
  for (const url of ["https://www.google.com/search?q=different", "https://www.google.com/maps?q=some+words",
    "https://evil.example/search?q=some+words", "http://www.google.com/search?q=some+words"]) {
    assert.notEqual(original, searchPageKey(url));
  }
  assert.notEqual(searchPageKey("https://search.example/search"), searchPageKey("https://search.example/search?q="));
});

test("Google Images is excluded and switching search modes changes identity", () => {
  const regular = "https://www.google.com/search?q=flowers";
  assert.equal(isSearchPage(regular, "google"), true);
  for (const mode of ["udm=2", "tbm=isch"]) {
    const images = `${regular}&${mode}`;
    assert.equal(isSearchPage(images, "google"), false);
    assert.notEqual(searchPageKey(regular), searchPageKey(images));
  }
  assert.equal(isSearchPage(`${regular}&udm=14`, "google"), true);
});

test("tracking rewrites retain the visible iframe and do not search a second time", async () => {
  const source = (await readFile(new URL("../src/searchInjection.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/gm, "");
  const connections = [];
  let poll;
  let removals = 0;
  let frame;
  const listeners = {};
  const location = { href: "https://www.google.com/search?q=private" };
  const sidebar = { prepend(frame) { frame.isConnected = true; } };
  const context = vm.createContext({
    getBrowser: () => ({ runtime: {
      id: "test",
      getURL: (path) => `chrome-extension://test/${path}`,
      connect() {
        const connection = {
          messages: [], onDisconnect: { addListener() {} },
          onMessage: { addListener(fn) { connection.receive = fn; } },
          postMessage(message) { this.messages.push(message); }, disconnect() {},
        };
        connections.push(connection);
        return connection;
      },
    } }),
    guardPort, isContextInvalidated, searchPageKey, AbortController, URL, location,
    window: { addEventListener(name, fn) { listeners[name] = fn; } },
    document: {
      documentElement: {},
      createElement() {
        frame = { style: {}, contentWindow: {}, remove() { removals++; this.isConnected = false; } };
        return frame;
      },
    },
    findSidebar: () => sidebar,
    waitForSidebar: async () => sidebar,
    pageAppearance: () => "light",
    MutationObserver: class { observe() {} disconnect() {} },
    setInterval(fn) { poll = fn; }, setTimeout() { return 1; }, clearTimeout() {}, clearInterval() {},
  });
  vm.runInContext(source, context);
  await connections[0].receive({ action: "prepared", engine: "google" });
  await connections[0].receive({ action: "frame", channel: "channel" });
  listeners.message({ source: frame.contentWindow, origin: "chrome-extension://test",
    data: { type: "bookmark-injector-size", channel: "channel", height: 300, colorScheme: "dark" } });
  assert.equal(frame.style.colorScheme, "dark");
  assert.equal(frame.style.height, "300px");
  listeners.message({ source: {}, origin: "https://www.google.com",
    data: { type: "bookmark-injector-size", channel: "channel", height: 100, colorScheme: "light" } });
  assert.equal(frame.style.colorScheme, "dark", "host page cannot override iframe layout messages");
  location.href = "https://www.google.com/search?q=private&sei=tracking#results";
  poll();
  assert.equal(connections.length, 1);
  assert.equal(removals, 0);
  assert.equal(connections[0].messages.filter((message) => message.action === "start").length, 1);
  location.href = "https://www.google.com/search?q=another";
  poll();
  assert.equal(connections.length, 2);
  assert.equal(removals, 1);
});
