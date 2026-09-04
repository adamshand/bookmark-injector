import { getBrowser } from "./browser.js";
import { getConfiguration } from "./configuration.js";
import { LinkdingApi } from "./linkding.js";
import { ReadeckApi } from "./readeck.js";
import { createSearchHandler } from "./search.js";
import { createConnectionRouter } from "./connections.js";
import { registerSearxScripts } from "./registration.js";

const browser = getBrowser();
// Chrome otherwise exposes local storage to content scripts by default.
if (browser.storage.local.setAccessLevel) {
  browser.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(console.error);
}
const search = createSearchHandler({
  getConfiguration,
  makeLinkding: (configuration) => new LinkdingApi(configuration),
  makeReadeck: (configuration) => new ReadeckApi(configuration),
});
const router = createConnectionRouter({
  runtime: browser.runtime, getConfiguration,
  getTab: (id) => browser.tabs.get(id), search,
});
browser.runtime.onConnect.addListener(router.connected);

let registration = Promise.resolve();
function refreshRegistration() {
  registration = registration.then(async () => {
    await registerSearxScripts(browser.scripting, await getConfiguration());
  }).catch((error) => console.error("Bookmark Injector: SearX registration failed", error));
}
browser.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local" || !_changes.ld_ext_config) return;
  router.invalidate();
  refreshRegistration();
});
browser.runtime.onInstalled.addListener(refreshRegistration);
browser.runtime.onStartup.addListener(refreshRegistration);
refreshRegistration();
