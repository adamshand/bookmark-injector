import { getBrowser, guardPort, isContextInvalidated } from "./browser.js";
import { findSidebar, pageAppearance, waitForSidebar } from "./placement.js";
import { searchPageKey } from "./searchIdentity.js";

// Dynamic SearX registration and static engine registrations may overlap after
// configuration changes. This flag lives in the isolated content-script world.
if (!globalThis.__bookmarkInjectorStarted) {
  globalThis.__bookmarkInjectorStarted = true;
  const browser = getBrowser();
  let current;
  let lastSearch;
  let placementRetries = 0;
  let disposed = false;
  let polling;
  const lifecycle = new AbortController();

  function stop() {
    const state = current;
    current = null;
    if (!state) return;
    state.abort.abort();
    state.observer?.disconnect();
    clearTimeout(state.timer);
    try { state.connection?.disconnect(); } catch (error) {
      if (!isContextInvalidated(error)) throw error;
      dispose();
    } finally { state.frame?.remove(); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(polling);
    lifecycle.abort();
    stop();
  }

  function refresh(force = false) {
    if (disposed) return;
    try {
      // Extension reloads leave old scripts and timers in open tabs, but remove
      // their runtime identity. Retire those scripts rather than reconnecting.
      if (!browser.runtime?.id) { dispose(); return; }
      startSearch(force);
    } catch (error) {
      if (!isContextInvalidated(error)) throw error;
      dispose();
    }
  }

  function startSearch(force) {
    const key = searchPageKey(location.href);
    if (!force && key === lastSearch) return;
    stop();
    if (disposed) return;
    if (key !== lastSearch) placementRetries = 0;
    lastSearch = key;
    const state = { abort: new AbortController() };
    current = state;
    // Resolve once while the context is valid, not from later DOM callbacks.
    state.frameUrl = browser.runtime.getURL("results/index.html");
    state.extensionOrigin = browser.runtime.getURL("").replace(/\/$/, "");
    const connection = browser.runtime.connect({ name: "search-controller" });
    state.connection = connection;
    const port = guardPort(connection, browser.runtime);
    connection.onMessage.addListener(async (message) => {
      if (current !== state) return;
      if (message.action === "revoked") {
        stop();
        lastSearch = null;
      } else if (message.action === "prepared") {
        state.engine = message.engine;
        const params = new URL(location.href).searchParams;
        const term = (params.has("q") ? params.get("q") :
          (state.engine === "searx" ? document.querySelector("input#q, input[name=q]")?.value || "" : "")).trim();
        if (!term) { stop(); return; }
        const sidebar = await waitForSidebar(document, state.engine, state.abort.signal);
        if (!sidebar || current !== state) { if (current === state) stop(); return; }
        port.postMessage({ action: "start", searchTerm: term.slice(0, 2000), appearance: pageAppearance(document) });
      } else if (message.action === "frame") {
        const frame = document.createElement("iframe");
        state.frame = frame;
        state.channel = message.channel;
        frame.src = `${state.frameUrl}#${message.channel}`;
        frame.title = "Private bookmark search results";
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "display:block;width:100%;min-width:0;height:100px;border:0;border-radius:8px;background:transparent;margin:0 0 20px;color-scheme:light dark;";
        const mount = () => {
          if (frame.isConnected || current !== state) return;
          if (state.mounted) {
            // Re-inserting an iframe reloads its document. Obtain a fresh,
            // tab-bound channel rather than replaying its consumed attachment.
            if (placementRetries < 2) { placementRetries += 1; refresh(true); }
            return;
          }
          const sidebar = findSidebar(document, state.engine);
          if (sidebar) { sidebar.prepend(frame); state.mounted = true; }
        };
        mount();
        // Engines can replace their sidebar shortly after initial rendering.
        // Retry placement for a bounded window; never observe the entire page forever.
        state.observer = new MutationObserver(mount);
        state.observer.observe(document.documentElement, { childList: true, subtree: true });
        state.timer = setTimeout(() => state.observer.disconnect(), 10000);
      }
    });
    port.postMessage({ action: "prepare", url: location.href });
  }

  window.addEventListener("message", (event) => {
    if (!current?.frame || event.source !== current.frame.contentWindow ||
        event.origin !== current.extensionOrigin) return;
    const message = event.data;
    if (message?.type !== "bookmark-injector-size" || message.channel !== current.channel ||
        !Number.isFinite(message.height)) return;
    current.frame.style.height = `${Math.min(18000, Math.max(80, message.height))}px`;
    // Keep the embedding element and child canvas on the same color scheme;
    // browsers otherwise paint an opaque light canvas behind transparent corners.
    if (["light", "dark"].includes(message.colorScheme)) {
      current.frame.style.colorScheme = message.colorScheme;
    }
  }, { signal: lifecycle.signal });
  window.addEventListener("pagehide", stop, { signal: lifecycle.signal });
  window.addEventListener("pageshow", (event) => { if (event.persisted) refresh(true); }, { signal: lifecycle.signal });
  window.addEventListener("popstate", () => refresh(), { signal: lifecycle.signal });
  // pushState does not emit an event in the isolated world. A cheap URL-only
  // check supports client-side searches without a perpetual DOM observer.
  // Tracking/fragment changes keep the current frame and its results intact.
  polling = setInterval(() => refresh(), 1000);
  refresh();
}
