import https from "node:https";
import { readFile } from "node:fs/promises";
import { once, EventEmitter } from "node:events";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

export function searchHtml({ dark = false, width = 372 } = {}) {
  return `<!doctype html><html style="color-scheme:${dark ? "dark" : "light"}">
  <head><title>Local search fixture</title></head>
  <body style="margin:20px;background:${dark ? "#202124" : "#fff"}">
    <h1>Search fixture</h1><input id="q" value="fixture">
    <div id="rcnt"><aside id="rhs" style="width:${width}px"><section id="sidebar"></section></aside></div>
    <script>window.receivedMessages=[];addEventListener('message',event=>receivedMessages.push(event.data));</script>
  </body></html>`;
}

// Synthetic browser scenarios, not provider compatibility snapshots. All API
// traffic really crosses HTTPS to this loopback server, including worker fetches.
export async function startFixtureServer() {
  const events = new EventEmitter();
  const requests = [];
  const gates = new Map();
  const offline = new Set();
  let origin;
  const server = https.createServer({
    key: await readFile(new URL("fixtures/localhost-key.pem", import.meta.url)),
    cert: await readFile(new URL("fixtures/localhost-cert.pem", import.meta.url)),
  }, async (req, res) => {
    const url = new URL(req.url, origin);
    const annotation = url.pathname.match(/^\/readeck\/api\/bookmarks\/(.+)\/annotations$/);
    const source = annotation ? "annotations" : url.pathname === "/linkding/api/bookmarks/" ? "linkding"
      : url.pathname === "/readeck/api/bookmarks" ? "readeck" : null;
    if (!source) {
      res.setHeader("Content-Type", "text/html");
      res.end(url.pathname.startsWith("/article/")
        ? "<!doctype html><title>Original article</title><h1>Original article</h1>"
        : searchHtml({ dark: url.searchParams.get("theme") === "dark", width: Number(url.searchParams.get("width")) || 372 }));
      return;
    }
    const term = annotation ? decodeURIComponent(annotation[1]).replace(/-read$/, "")
      : url.searchParams.get(source === "linkding" ? "q" : "search") || "";
    const sent = deferred();
    res.once("finish", sent.resolve);
    res.once("close", sent.resolve);
    const request = { source, term, url: url.href, sent: sent.promise };
    requests.push(request);
    events.emit("request", request);
    res.setHeader("Content-Type", "application/json");
    const authorization = source === "linkding" ? "Token fixture-link-token" : "Bearer fixture-read-token";
    if (req.headers.authorization !== authorization) {
      res.writeHead(401); res.end(JSON.stringify({ detail: "Invalid token" })); return;
    }
    const gate = gates.get(`${source}:${term}`);
    if (gate) await gate.promise;
    if (res.destroyed) return;
    if (offline.has(source)) { res.writeHead(503); res.end("{}"); return; }
    if (source === "linkding") {
      res.end(JSON.stringify({ count: 1, results: [{
        url: `${origin}/article/${encodeURIComponent(term)}`, title: `Private Linkding ${term}`,
        description: "Confidential description", tag_names: ["private"],
      }] }));
    } else if (source === "readeck") {
      res.setHeader("Total-Count", "1");
      res.end(JSON.stringify([{
        id: `${term}-read`, url: `${origin}/article/${encodeURIComponent(term)}-read`,
        title: `Private Readeck ${term}`, note: "Confidential bookmark note", labels: ["private"],
      }]));
    } else {
      res.end(JSON.stringify([{ text: `Highlighted ${term}`, note: "Confidential annotation ".repeat(24) }]));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `https://127.0.0.1:${server.address().port}`;
  return {
    origin, unauthorizedOrigin: `https://localhost:${server.address().port}`, requests, offline,
    hold(source, term) {
      const gate = deferred();
      gates.set(`${source}:${term}`, gate);
      return () => { gate.resolve(); gates.delete(`${source}:${term}`); };
    },
    async waitForRequest(source, term) {
      const existing = requests.find((request) => request.source === source && request.term === term);
      if (existing) return existing;
      return new Promise((resolve) => {
        const listener = (request) => {
          if (request.source !== source || request.term !== term) return;
          events.off("request", listener);
          resolve(request);
        };
        events.on("request", listener);
      });
    },
    async close() {
      for (const gate of gates.values()) gate.resolve();
      events.removeAllListeners();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
