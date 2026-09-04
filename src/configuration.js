import { getStorage } from "./browser.js";

const CONFIG_KEY = "ld_ext_config";

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
  return new Promise((resolve) => {
    storage.get(CONFIG_KEY, (data) => {
      try {
        resolve(normalizeConfiguration(JSON.parse(data?.[CONFIG_KEY] || "{}")));
      } catch (error) {
        console.error("Bookmark Injector: failed to parse configuration", error);
        resolve(normalizeConfiguration());
      }
    });
  });
}

export function saveConfiguration(config, storage = getStorage()) {
  const configJson = JSON.stringify(config);
  return new Promise((resolve) => {
    storage.set({ [CONFIG_KEY]: configJson }, resolve);
  });
}
