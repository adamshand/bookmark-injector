import { getBrowser } from "./browser.js";
import { buildResultsPanelHtml } from "./render.js";

const browser = getBrowser();
const port = browser.runtime.connect({ name: "port-from-cs" });
port.onDisconnect.addListener(() => {
  // Chrome closes extension ports when a page enters its back/forward cache.
  // Observing lastError marks that expected lifecycle event as handled.
  void browser.runtime.lastError;
});
let searchEngine;
if (document.location.hostname.match(/duckduckgo\.com/)) {
  searchEngine = "duckduckgo";
} else if (document.location.hostname.match(/google/)) {
  searchEngine = "google";
} else if (document.location.hostname.match(/search\.brave\.com/)) {
  searchEngine = "brave";
} else if (document.location.hostname.match(/kagi\.com/)) {
  searchEngine = "kagi";
} else if (document.location.href.match(/http.?:\/\/.+\/search/)) {
  searchEngine = "searx";
} else if (document.location.hostname.match(/qwant\.com/)) {
  searchEngine = "qwant";
} else {
  console.debug("Bookmark Injector extension: unknown search engine.");
}

// CSS selectors for finding the sidebar to later inject into. Keep this block
// aligned with upstream linkding-injector so its frequent engine fixes remain
// straightforward to merge.
const sidebarSelectors = {
  duckduckgo: "section[data-area=sidebar]",
  google: "#rhs",
  brave: "#mixed-side",
  searx: "#sidebar",
  kagi: ".right-content-box > ._0_right_sidebar",
  qwant: ".is-sidebar",
};

// When the background script answers, construct the result box. Provider data
// has already been normalized; search-engine placement remains upstream-shaped.
port.onMessage.addListener(function (message) {
  const parser = new DOMParser();
  let htmlString;

  if ("message" in message) {
    const showLogo = message.config?.showLogo ?? true;
    htmlString = `
    <div id="bookmark-list-container" class="${searchEngine}">
      <div id="navbar">
        <a id="ld-logo">
          ${showLogo ? `<img src="${browser.runtime.getURL("icons/logo_32.png")}" class="setup" />` : ""}
          <h1>bookmark injector</h1>
        </a>
        <a id="ld-options" class="openOptions">
          <img class="ld-settings" src="${browser.runtime.getURL("icons/cog.svg")}" />
        </a>
      </div>
      <div id="error-message">${message.message}</div>
    </div>`;
  } else {
    const providers = (message.providers || []).filter(
      (provider) => provider.results.length > 0,
    );
    if (providers.length === 0) {
      if (message.warnings?.length) {
        console.error("bookmark injector:", message.warnings.join("; "));
      }
      return;
    }

    const themes = {
      duckduckgo: message.config.themeDuckduckgo,
      google: message.config.themeGoogle,
      brave: message.config.themeBrave,
      searx: message.config.themeSearx,
      kagi: message.config.themeKagi,
      qwant: message.config.themeQwant,
    };
    const theme = themes[searchEngine];
    const themeClass = theme === "auto" ? "" : theme;
    htmlString = buildResultsPanelHtml({
      searchEngine,
      themeClass,
      openLinkType: message.config.openLinkType,
      showLogo: message.config.showLogo,
      logoUrl: browser.runtime.getURL("icons/logo_32.png"),
      optionsUrl: browser.runtime.getURL("icons/cog.svg"),
      sourceIcons: {
        linkding: browser.runtime.getURL("icons/ld_32.png"),
        readeck: browser.runtime.getURL("icons/readeck.svg"),
      },
      providers,
    });
  }

  // Finding the sidebar. This placement code intentionally tracks upstream.
  const sidebarSelector = sidebarSelectors[searchEngine];
  let sidebar = document.querySelector(sidebarSelector);

  // Google completely omits the sidebar container if there is no content.
  // We need to add it manually before injection.
  if (searchEngine === "google" && sidebar === null) {
    const sidebarContainerString = `
    <div id="rhs" class="TQc1id hSOk2e rhstc4"></div>`;
    const sidebarContainer = parser.parseFromString(
      sidebarContainerString,
      "text/html",
    );
    const container = document.querySelector("#rcnt");
    container.appendChild(sidebarContainer.body.querySelector("div"));
    sidebar = document.querySelector("#rhs");
  }

  const html = parser.parseFromString(htmlString, "text/html");
  if (document.querySelector("#bookmark-list-container") == null) {
    sidebar.prepend(html.body.querySelector("div"));
  }

  document.querySelectorAll(".openOptions").forEach((element) => {
    element.addEventListener("click", () => {
      port.postMessage({ action: "openOptions" });
    });
  });
});

// Start the search by sending a message to background.js with the search term.
// Keep extraction and delayed engine behavior close to upstream; the query is
// URL-encoded by each provider rather than HTML-escaped before transport.
const urlParams = new URLSearchParams(location.search);
let searchTerm = urlParams.get("q") || "";
if (searchEngine === "searx") {
  searchTerm = document.querySelector("input#q")?.value || "";
}

if (searchEngine === "brave") {
  // Brave search seems to remove the injection box if it is injected too soon.
  // Wait a bit before injecting.
  setTimeout(function () {
    port.postMessage({ searchTerm });
  }, 1600);
} else if (searchEngine === "qwant") {
  // Qwant asynchronously loads the sidebar. We need to watch for when the
  // sidebar is loaded and only then start the injection.
  const qwantObserver = new MutationObserver((_mutations, observer) => {
    if (document.querySelector(sidebarSelectors.qwant)) {
      port.postMessage({ searchTerm });
      observer.disconnect();
    }
  });

  qwantObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
} else {
  port.postMessage({ searchTerm });
}
