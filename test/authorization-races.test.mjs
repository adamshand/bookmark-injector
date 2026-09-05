import assert from "node:assert/strict";
import test from "node:test";
import { createConnectionRouter } from "../src/connections.js";
import { createSearchHandler } from "../src/search.js";
import { LinkdingApi } from "../src/linkding.js";
import { normalizeConfiguration } from "../src/configuration.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function event() {
  const listeners = [];
  return { addListener(fn) { listeners.push(fn); },
    emit(value) { return Promise.all(listeners.map((fn) => fn(value))); } };
}

function fixture(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const config = normalizeConfiguration({
    searxOrigins: ["https://search.example"],
    linkding: { enabled: true, baseUrl: "https://links.example", token: "fixture-token" },
  });
  const runtime = { id: "extension", getURL: (path) => `chrome-extension://extension/${path}` };
  const pageUrl = "https://search.example/search?q=private";
  const requests = [];
  const ports = [];
  let nextPause;
  const getConfiguration = async () => structuredClone(config);
  const search = createSearchHandler({ getConfiguration,
    makeLinkding: (configuration) => new LinkdingApi(configuration, async (url) => {
      requests.push(url);
      return { status: 200, json: async () => ({ count: 1, results: [
        { url: "https://private.example", title: "Private bookmark" },
      ] }) };
    }),
  });
  const router = createConnectionRouter({ runtime, getConfiguration, search,
    async getTab() {
      if (nextPause) {
        const pause = nextPause;
        nextPause = null;
        pause.entered.resolve();
        await pause.release.promise;
      }
      return { url: pageUrl };
    },
  });
  function connect(name, frameId) {
    const p = { name, sender: { id: runtime.id, tab: { id: 1 }, frameId,
      url: frameId === 0 ? pageUrl : runtime.getURL("results/index.html") },
      messages: [], closed: false, onMessage: event(), onDisconnect: event(),
      postMessage(message) {
        if (this.closed) throw new Error("Port closed");
        this.messages.push(structuredClone(message));
      },
      disconnect() { if (this.closed) return; this.closed = true; this.onDisconnect.emit(); },
    };
    ports.push(p);
    router.connected(p);
    return p;
  }
  t.after(() => { router.invalidate(); for (const port of ports) port.disconnect(); });
  return { config, router, requests, connect,
    pauseAuthorization() {
      nextPause = { entered: deferred(), release: deferred() };
      return nextPause;
    },
    async prepare() {
      const controller = connect("search-controller", 0);
      await controller.onMessage.emit({ action: "prepare", url: pageUrl });
      await controller.onMessage.emit({ action: "start", searchTerm: "private" });
      return { controller, channel: controller.messages.at(-1).channel };
    },
  };
}

test("revocation while iframe authorization is awaiting a tab lookup starts no provider request", async (t) => {
  const f = fixture(t);
  const { channel } = await f.prepare();
  const pause = f.pauseAuthorization();
  const frame = f.connect("results-frame", 4);
  const attachment = frame.onMessage.emit({ action: "attach", channel });
  await pause.entered.promise;
  f.config.searxOrigins = [];
  f.router.invalidate();
  pause.release.resolve();
  await attachment;
  assert.deepEqual(f.requests, []);
  assert.equal(frame.closed, true);
  assert.deepEqual(frame.messages, []);
});

test("disconnect during attachment cannot deliver late private results", async (t) => {
  const f = fixture(t);
  const { controller, channel } = await f.prepare();
  const pause = f.pauseAuthorization();
  const frame = f.connect("results-frame", 4);
  const attachment = frame.onMessage.emit({ action: "attach", channel });
  await pause.entered.promise;
  controller.disconnect();
  pause.release.resolve();
  await attachment;
  assert.equal(frame.closed, true);
  assert.deepEqual(f.requests, []);
  assert.deepEqual(frame.messages, []);
});

test("concurrent iframe attachments consume a channel once, even while the winner is awaiting authorization", async (t) => {
  const f = fixture(t);
  const { channel } = await f.prepare();
  const pause = f.pauseAuthorization();
  const first = f.connect("results-frame", 4);
  const winner = first.onMessage.emit({ action: "attach", channel });
  await pause.entered.promise;
  const second = f.connect("results-frame", 5);
  await second.onMessage.emit({ action: "attach", channel });
  assert.equal(second.closed, true);
  pause.release.resolve();
  await winner;
  assert.equal(f.requests.length, 1);
  assert.equal(first.messages.at(-1).providers[0].results[0].title, "Private bookmark");
  assert.deepEqual(second.messages, []);
});

test("an expired channel cannot be attached or replayed", async (t) => {
  const f = fixture(t);
  const { controller, channel } = await f.prepare();
  t.mock.timers.tick(30001);
  assert.equal(controller.closed, true);
  const frame = f.connect("results-frame", 4);
  await frame.onMessage.emit({ action: "attach", channel });
  assert.equal(frame.closed, true);
  assert.deepEqual(f.requests, []);
  assert.deepEqual(frame.messages, []);
});
