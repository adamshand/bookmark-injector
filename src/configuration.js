import { getBrowser, getStorage } from "./browser.js";
import { normalizeSearxOrigins } from "./engines.js";
import { httpsBaseUrl } from "./network.js";

const CONFIG_KEY = "ld_ext_config";

function storageError() {
  try { return getBrowser().runtime.lastError?.message; } catch { return null; }
}

const DEFAULT_CONFIG = {
  linkding: {
    enabled: false,
    baseUrl: "",
    token: "",
  },
  readeck: {
    enabled: false,
    baseUrl: "",
    token: "",
    enrichAnnotations: true,
  },
  searxOrigins: [],
  resultNum: 10,
  showLogo: true,
  openLinkType: "newTab",
  themeGoogle: "auto",
  themeDuckduckgo: "auto",
  themeBrave: "auto",
  themeSearx: "auto",
  themeKagi: "auto",
  themeQwant: "auto",
};

export function normalizeConfiguration(saved = {}) {
  const source = saved && typeof saved === "object" ? saved : {};
  const { baseUrl = "", token = "", ...current } = source;
  return {
    ...DEFAULT_CONFIG,
    ...current,
    linkding: {
      ...DEFAULT_CONFIG.linkding,
      enabled: Boolean(baseUrl && token),
      baseUrl,
      token,
      ...(current.linkding || {}),
    },
    readeck: {
      ...DEFAULT_CONFIG.readeck,
      ...(current.readeck || {}),
    },
  };
}

export function getConfiguration(storage = getStorage()) {
  return new Promise((resolve, reject) => {
    storage.get(CONFIG_KEY, (data) => {
      const error = storageError();
      if (error) { reject(new Error(error)); return; }
      try {
        resolve(normalizeConfiguration(JSON.parse(data?.[CONFIG_KEY] || "{}")));
      } catch (error) {
        console.error("Bookmark Injector: failed to parse configuration", error);
        resolve(normalizeConfiguration());
      }
    });
  });
}

export function validateConfiguration(config) {
  const normalized = normalizeConfiguration(config);
  normalized.searxOrigins = normalizeSearxOrigins(normalized.searxOrigins);
  for (const source of ["linkding", "readeck"]) {
    const provider = normalized[source];
    if (!provider.enabled) continue;
    if (!String(provider.token || "").trim()) throw new Error(`${source}: an API token is required`);
    provider.baseUrl = httpsBaseUrl(provider.baseUrl, source);
  }
  normalized.resultNum = Math.min(100, Math.max(1, Math.trunc(Number(normalized.resultNum) || 10)));
  return normalized;
}

export function saveConfiguration(config, storage = getStorage()) {
  const configJson = JSON.stringify(validateConfiguration(config));
  return new Promise((resolve, reject) => {
    storage.set({ [CONFIG_KEY]: configJson }, () => {
      const error = storageError();
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}
