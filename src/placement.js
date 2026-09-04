import { sidebarSelectors } from "./engines.js";

export function findSidebar(document, engine) {
  for (const selector of sidebarSelectors[engine] || []) {
    const sidebar = document.querySelector(selector);
    if (sidebar) return sidebar;
  }
  if (engine === "google") {
    const container = document.querySelector("#rcnt");
    if (container) {
      const sidebar = document.createElement("div");
      sidebar.id = "rhs";
      sidebar.className = "TQc1id hSOk2e rhstc4";
      container.appendChild(sidebar);
      return sidebar;
    }
  }
  return null;
}

export function waitForSidebar(document, engine, signal, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let observer;
    let timer;
    const finish = (sidebar) => {
      observer?.disconnect();
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      resolve(sidebar);
    };
    const aborted = () => finish(null);
    if (signal.aborted) { resolve(null); return; }
    const sidebar = findSidebar(document, engine);
    if (sidebar) { resolve(sidebar); return; }
    observer = new MutationObserver(() => {
      const found = findSidebar(document, engine);
      if (found) finish(found);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
  });
}

export function pageAppearance(document) {
  for (const element of [document.body, document.documentElement]) {
    if (!element) continue;
    const channels = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (channels?.length >= 3 && (channels.length < 4 || channels[3] > 0.5)) {
      return channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114 < 128 ? "dark" : "light";
    }
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
