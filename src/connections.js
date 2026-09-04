import { engineForUrl, isSearchPage } from "./engines.js";
import { guardPort } from "./browser.js";
import { searchPageKey } from "./searchIdentity.js";

const withoutHash = (value) => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch { return null; }
};

// Only validated, top-level content scripts can create a search. A one-use
// channel binds an extension iframe to that tab; iframe URLs alone confer no authority.
export function createConnectionRouter({ runtime, getConfiguration, getTab, search,
  randomChannel = () => crypto.randomUUID() }) {
  const pending = new Map();
  const controllers = new Set();
  const frameUrl = runtime.getURL("results/index.html");

  async function authorized(sender, pageUrl) {
    if (sender?.id !== runtime.id || !Number.isInteger(sender.tab?.id)) return null;
    const config = await getConfiguration();
    const tab = await getTab(sender.tab.id);
    // sender.url can retain the document's original URL after pushState.
    // Check its origin, then bind to the current tab's route and query. Ignore
    // tracking rewrites even during attachment, but never an actual search change.
    if (new URL(tab.url).origin !== new URL(sender.url).origin ||
        searchPageKey(tab.url) !== searchPageKey(pageUrl)) return null;
    const engine = engineForUrl(tab.url, config.searxOrigins);
    return isSearchPage(tab.url, engine) ? engine : null;
  }

  function connected(port) {
    const guarded = guardPort(port, runtime);
    if (port.name === "search-controller") {
      const sender = port.sender;
      if (sender?.frameId !== 0) { port.disconnect(); return; }
      let session;
      let preparing = false;
      let closed = false;
      const cleanup = () => {
        closed = true;
        controllers.delete(port);
        if (session) {
          clearTimeout(session.timer);
          pending.delete(session.channel);
          session.frame?.disconnect();
        }
      };
      controllers.add(port);
      port.onDisconnect.addListener(cleanup);
      port.onMessage.addListener(async (message) => {
        try {
          if (message?.action === "prepare" && !preparing && !session) {
            preparing = true;
            const engine = await authorized(sender, message.url);
            if (closed) return;
            if (!engine) { port.disconnect(); return; }
            session = { channel: randomChannel(), sender, pageUrl: message.url, engine, controller: port, closed: () => closed };
            session.timer = setTimeout(() => port.disconnect(), 30000);
            guarded.postMessage({ action: "prepared", engine });
          } else if (message?.action === "start" && session && !session.started) {
            if (typeof message.searchTerm !== "string" || !message.searchTerm.trim() || message.searchTerm.length > 2000) {
              port.disconnect(); return;
            }
            session.started = true;
            session.searchTerm = message.searchTerm.trim();
            session.appearance = message.appearance === "dark" ? "dark" : "light";
            pending.set(session.channel, session);
            guarded.postMessage({ action: "frame", channel: session.channel });
          }
        } catch { port.disconnect(); }
      });
      return;
    }

    if (port.name !== "results-frame" || port.sender?.id !== runtime.id ||
        !(port.sender.frameId > 0) || withoutHash(port.sender.url) !== frameUrl) {
      port.disconnect(); return;
    }
    let attached = false;
    let closed = false;
    port.onDisconnect.addListener(() => { closed = true; });
    const attachTimer = setTimeout(() => port.disconnect(), 5000);
    port.onDisconnect.addListener(() => clearTimeout(attachTimer));
    port.onMessage.addListener(async (message) => {
      try {
        if (message?.action !== "attach" || attached) return;
        const session = pending.get(message.channel);
        if (!session || session.sender.tab.id !== port.sender.tab?.id) { port.disconnect(); return; }
        // Consume before awaiting to prevent concurrent/replayed attachment.
        pending.delete(message.channel);
        const engine = await authorized(session.sender, session.pageUrl);
        if (closed || session.closed() || !engine) { port.disconnect(); return; }
        attached = true;
        clearTimeout(attachTimer);
        clearTimeout(session.timer);
        session.frame = port;
        guarded.postMessage({ engine, appearance: session.appearance });
        await search(guarded, { searchTerm: session.searchTerm });
      } catch { port.disconnect(); }
    });
  }

  return {
    connected,
    invalidate() {
      // Settings changes revoke active searches as well as future authorization.
      for (const port of [...controllers]) {
        try { port.postMessage({ action: "revoked" }); } catch { /* Already closed. */ }
        port.disconnect();
      }
    },
  };
}
