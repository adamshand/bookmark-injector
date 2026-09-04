import { getBrowser, openOptions } from "./browser.js";
import { getConfiguration } from "./configuration.js";
import { LinkdingApi } from "./linkding.js";
import { ReadeckApi } from "./readeck.js";
import { createSearchHandler, guardPort } from "./search.js";

const browser = getBrowser();
const search = createSearchHandler({
  getConfiguration,
  makeLinkding: (configuration) => new LinkdingApi(configuration),
  makeReadeck: (configuration) => new ReadeckApi(configuration),
});

// Keep this connection and search-engine wiring deliberately small. Upstream
// changes its content-script targets often; provider behavior belongs behind
// the normalized message produced by search.js instead.
function connected(port) {
  const guarded = guardPort(port, browser.runtime);
  port.onMessage.addListener(async (message) => {
    if (message.action === "openOptions") {
      openOptions();
      return;
    }
    await search(guarded, message);
  });
}

browser.runtime.onConnect.addListener(connected);
