import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { guardPort, isContextInvalidated } from "../src/browser.js";
import { searchPageKey } from "../src/searchIdentity.js";

const source = (await readFile(new URL("../src/searchInjection.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "");
const invalidated = () => new Error("Extension context invalidated.");

function fixture() {
  let poll;
  let lifecycle;
  let attempts = 0;
  let cleared = 0;
  let removed = 0;
  let observed = 0;
  let pendingSignal;
  const listeners = {};
  const connection = {
    onDisconnect: { addListener() {} },
    onMessage: { addListener(fn) { connection.receive = fn; } },
    postMessage() {}, disconnect() {},
  };
  const runtime = {
    id: "test",
    getURL: (path) => `chrome-extension://test/${path}`,
    connect() { attempts++; return connection; },
  };
  const location = { href: "https://www.google.com/search?q=private" };
  const sidebar = { prepend(frame) { frame.isConnected = true; } };
  const context = vm.createContext({
    getBrowser: () => ({ runtime }), guardPort, isContextInvalidated, searchPageKey,
    AbortController, URL, location,
    window: { addEventListener(name, fn, options) { listeners[name] = fn; lifecycle = options.signal; } },
    document: { documentElement: {}, createElement() {
      return { style: {}, contentWindow: {}, remove() { removed++; } };
    } },
    findSidebar: () => sidebar,
    waitForSidebar: async (_document, _engine, signal) => { pendingSignal = signal; return sidebar; },
    pageAppearance: () => "light",
    MutationObserver: class { observe() { observed++; } disconnect() { observed--; } },
    setInterval(fn) { poll = fn; return 123; },
    clearInterval(id) { assert.equal(id, 123); cleared++; },
    setTimeout() { return 456; }, clearTimeout() {},
  });
  return { runtime, connection, location, listeners,
    start: () => vm.runInContext(source, context),
    poll: () => poll(),
    get state() { return { attempts, cleared, removed, observed, aborted: lifecycle.aborted, searchAborted: pendingSignal?.aborted }; },
  };
}

test("an extension reload retires unchanged-page polling, observers, listeners and iframe", async () => {
  const f = fixture();
  f.start();
  await f.connection.receive({ action: "prepared", engine: "google" });
  await f.connection.receive({ action: "frame", channel: "channel" });
  f.runtime.id = undefined;
  f.runtime.getURL = () => { throw invalidated(); };
  f.connection.disconnect = () => { throw invalidated(); };
  assert.doesNotThrow(() => f.poll());
  assert.deepEqual(f.state, { attempts: 1, cleared: 1, removed: 1, observed: 0, aborted: true, searchAborted: true });
  f.location.href = "https://www.google.com/search?q=another";
  f.poll();
  f.listeners.pageshow({ persisted: true });
  f.listeners.popstate();
  assert.equal(f.state.attempts, 1, "a retired context must never reconnect");
});

test("invalidation races during URL resolution or connect shut down partial initialization", () => {
  for (const method of ["getURL", "connect"]) {
    const f = fixture();
    f.runtime[method] = () => { throw invalidated(); };
    assert.doesNotThrow(() => f.start());
    assert.equal(f.state.cleared, 1);
    assert.equal(f.state.aborted, true);
    assert.doesNotThrow(() => f.poll());
  }
});

test("ordinary pagehide/pageshow can reconnect, while unrelated errors are not swallowed", () => {
  const f = fixture();
  f.start();
  f.listeners.pagehide();
  assert.equal(f.state.aborted, false);
  f.listeners.pageshow({ persisted: true });
  assert.equal(f.state.attempts, 2);
  const broken = fixture();
  broken.runtime.connect = () => { throw new Error("Unexpected bug"); };
  assert.throws(() => broken.start(), /Unexpected bug/);
});

test("closed-port handling tolerates invalidated lastError access", () => {
  let disconnect;
  const runtime = { get lastError() { throw invalidated(); } };
  const port = { onDisconnect: { addListener(fn) { disconnect = fn; } },
    postMessage() { throw invalidated(); },
  };
  const guarded = guardPort(port, runtime);
  assert.doesNotThrow(() => guarded.postMessage({}));
  assert.doesNotThrow(() => disconnect());
});
