import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { guardPort } from "../src/browser.js";

// Exercise content-script lifecycle without a browser or generated bundle.
test("duplicate initialization opens one port; blank queries never start a search", async () => {
  const source = (await readFile(new URL("../src/searchInjection.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/gm, "");
  let connections = 0;
  let listener;
  const messages = [];
  const connection = {
    onDisconnect: { addListener() {} },
    onMessage: { addListener(fn) { listener = fn; } },
    postMessage(message) { messages.push(message); },
    disconnect() {},
  };
  const context = vm.createContext({
    getBrowser: () => ({ runtime: { connect() { connections++; return connection; } } }),
    guardPort, AbortController, URL, clearTimeout,
    location: { href: "https://approved.example/search?q=" },
    window: { addEventListener() {} },
    document: { querySelector() { return { value: "stale POST input" }; } },
    setInterval() {},
    waitForSidebar() { throw new Error("Blank search should not wait for a sidebar"); },
  });
  vm.runInContext(source, context);
  vm.runInContext(source, context);
  assert.equal(connections, 1);
  await listener({ action: "prepared", engine: "searx" });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "prepare");
});
