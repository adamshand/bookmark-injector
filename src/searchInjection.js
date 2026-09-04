import { getBrowser, guardPort } from "./browser.js";
import { findSidebar, pageAppearance, waitForSidebar } from "./placement.js";

// Dynamic SearX registration and static engine registrations may overlap after
// configuration changes. This flag lives in the isolated content-script world.
if (!globalThis.__bookmarkInjectorStarted) {
  globalThis.__bookmarkInjectorStarted = true;
  const browser = getBrowser();
  let current;
  let lastUrl;
  let placementRetries = 0;

  function stop() {
    if (!current) return;
    current.abort.abort();
    current.observer?.disconnect();
    clearTimeout(current.timer);
    current.connection.disconnect();
    current.frame?.remove();
    current = null;
  }

  function refresh(force = false) {
    if (!force && location.href === lastUrl) return;
    stop();
    if (location.href !== lastUrl) placementRetries = 0;
    lastUrl = location.href;
    const state = { abort: new AbortController() };
    current = state;
    const connection = browser.runtime.connect({ name: "search-controller" });
    state.connection = connection;
    const port = guardPort(connection, browser.runtime);
    connection.onMessage.addListener(async (message) => {
      if (current !== state) return;
      if (message.action === "revoked") {
        stop();
        lastUrl = null;
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
        frame.src = `${browser.runtime.getURL("results/index.html")}#${message.channel}`;
        frame.title = "Private bookmark search results";
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "display:block;width:100%;min-width:0;height:100px;border:0;margin:0 0 20px;color-scheme:normal;";
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
        event.origin !== browser.runtime.getURL("").replace(/\/$/, "")) return;
    const message = event.data;
    if (message?.type !== "bookmark-injector-size" || message.channel !== current.channel ||
        !Number.isFinite(message.height)) return;
    current.frame.style.height = `${Math.min(18000, Math.max(80, message.height))}px`;
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", (event) => { if (event.persisted) refresh(true); });
  window.addEventListener("popstate", () => refresh());
  // pushState does not emit an event in the isolated world. A cheap URL-only
  // check supports client-side searches without a perpetual DOM observer.
  setInterval(() => refresh(), 1000);
  refresh();
}
