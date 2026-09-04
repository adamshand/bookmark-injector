import { getBrowser, guardPort } from "./browser.js";
import { buildResultsPanelHtml } from "./render.js";

const browser = getBrowser();
const channel = location.hash.slice(1);
const connection = browser.runtime.connect({ name: "results-frame" });
const port = guardPort(connection, browser.runtime);
const root = document.querySelector("#results");
let engine;
let appearance = "light";
let done = false;
let lastLayout;

function resize() {
  const height = Math.ceil(root.getBoundingClientRect().height);
  const colorScheme = document.documentElement.style.colorScheme || appearance;
  const layout = `${height}:${colorScheme}`;
  if (layout === lastLayout) return;
  lastLayout = layout;
  // Only layout/theme metadata is page-visible. No results, counts, URLs, or errors.
  parent.postMessage({ type: "bookmark-injector-size", channel, height, colorScheme }, "*");
}

connection.onMessage.addListener((message) => {
  if (message.engine) {
    engine = message.engine;
    appearance = message.appearance;
    return;
  }
  if (!message.config || !engine) return;
  done = message.done;
  const themeKey = `theme${engine[0].toUpperCase()}${engine.slice(1)}`;
  const theme = message.config[themeKey];
  const themeClass = ["light", "dark"].includes(theme) ? theme : appearance;
  document.documentElement.style.colorScheme = themeClass;
  const html = buildResultsPanelHtml({
    searchEngine: engine,
    themeClass,
    openLinkType: message.config.openLinkType,
    showLogo: message.config.showLogo,
    logoUrl: browser.runtime.getURL("icons/logo_32.png"),
    optionsUrl: browser.runtime.getURL("icons/cog.svg"),
    sourceIcons: {
      linkding: browser.runtime.getURL("icons/ld_32.png"),
      readeck: browser.runtime.getURL("icons/readeck.svg"),
    },
    providers: message.providers || [],
  });
  root.replaceChildren(new DOMParser().parseFromString(html, "text/html").body.firstElementChild);
  const panel = root.firstElementChild;
  const status = document.createElement("p");
  status.className = "bookmark-status";
  status.setAttribute("role", "status");
  status.textContent = message.message || (done ? "" : "Searching bookmark services…");
  if (done && !message.message && !message.providers.some((provider) => provider.results.length)) {
    status.textContent = "No matching bookmarks.";
  }
  if (status.textContent) panel.append(status);
  for (const warning of message.warnings || []) {
    const element = document.createElement("p");
    element.className = "bookmark-warning";
    element.textContent = warning;
    panel.append(element);
  }
  root.querySelector(".openOptions")?.addEventListener("click", () => browser.runtime.openOptionsPage());
  resize();
});
connection.onDisconnect.addListener(() => {
  if (done) return;
  const status = document.createElement("p");
  status.textContent = "Search disconnected. Reload the search page to retry.";
  status.className = "bookmark-status";
  root.append(status);
  resize();
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.ld_ext_config) return;
  // Also clear completed frames after an idle MV3 worker has been suspended.
  done = true;
  connection.disconnect();
  root.textContent = "Settings changed. Reload the search page to apply them.";
  resize();
});
new ResizeObserver(resize).observe(root);
port.postMessage({ action: "attach", channel });
