import { engineForUrl, normalizeSearxOrigins } from "./engines.js";

export async function registerSearxScripts(scripting, config) {
  const id = "approved-searx";
  const existing = await scripting.getRegisteredContentScripts({ ids: [id] });
  const origins = normalizeSearxOrigins(config.searxOrigins || []);
  // Match patterns cannot express a port consistently across browsers. Limit
  // injection by hostname here; the background checks the exact origin/port.
  const matches = [...new Set(origins.filter((origin) => !engineForUrl(origin)).map(
    (origin) => `https://${new URL(origin).hostname}/*`,
  ))];
  if (!matches.length) {
    if (existing.length) await scripting.unregisterContentScripts({ ids: [id] });
    return;
  }
  const script = { id, matches, js: ["build/searchInjection.js"], runAt: "document_idle", persistAcrossSessions: true };
  if (existing.length) await scripting.updateContentScripts([script]);
  else await scripting.registerContentScripts([script]);
}
