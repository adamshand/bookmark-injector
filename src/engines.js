import { GOOGLE_DOMAINS } from "./google-domains.js";

const googleHosts = new Set(GOOGLE_DOMAINS.flatMap((domain) => [domain, `www.${domain}`]));
const engines = new Map([
  ["duckduckgo.com", "duckduckgo"], ["www.duckduckgo.com", "duckduckgo"],
  ["html.duckduckgo.com", "duckduckgo"], ["lite.duckduckgo.com", "duckduckgo"],
  ["search.brave.com", "brave"], ["kagi.com", "kagi"], ["www.qwant.com", "qwant"],
]);

export function normalizeSearxOrigins(values) {
  if (!Array.isArray(values)) throw new Error("SearX instances must be a list of URLs");
  return [...new Set(values.filter((value) => String(value).trim()).map((value) => {
    const url = new URL(String(value).trim());
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("SearX instances require HTTPS URLs without embedded credentials");
    }
    return url.origin;
  }))];
}

export function engineForUrl(value, searxOrigins = []) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    // Nonstandard ports are not implicitly trusted on public search engines.
    if (!url.port) {
      if (googleHosts.has(url.hostname)) return "google";
      if (engines.has(url.hostname)) return engines.get(url.hostname);
    }
    if (normalizeSearxOrigins(searxOrigins).includes(url.origin)) return "searx";
  } catch { /* Invalid or unapproved URLs fail closed. */ }
  return null;
}

export function isSearchPage(value, engine) {
  if (!engine) return false;
  const url = new URL(value);
  if (engine === "google" || engine === "brave") return /^\/search\/?$/.test(url.pathname);
  if (engine === "kagi") return ["/", "/search", "/search/"].includes(url.pathname);
  if (engine === "duckduckgo") return /^\/(?:html\/?|lite\/?)?$/.test(url.pathname);
  if (engine === "qwant") return ["/", "/search", "/search/"].includes(url.pathname);
  // Approved self-hosted instances may live under a path prefix and use POST.
  return /\/(?:search\/?)?$/.test(url.pathname) || url.searchParams.has("q");
}

export const sidebarSelectors = {
  duckduckgo: ["section[data-area=sidebar]", ".results--sidebar"],
  google: ["#rhs"],
  brave: ["#mixed-side"],
  searx: ["#sidebar", "aside.sidebar"],
  kagi: [".right-content-box > ._0_right_sidebar", "._0_right_sidebar"],
  qwant: [".is-sidebar"],
};
