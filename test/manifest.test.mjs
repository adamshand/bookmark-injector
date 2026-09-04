import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { firefoxManifest } from "../src/manifests.js";
import { GOOGLE_DOMAINS } from "../src/google-domains.js";
import { engineForUrl } from "../src/engines.js";

const root = new URL("../manifest.json", import.meta.url);

test("the unpacked manifest is valid MV3 for Chrome and derives a Firefox background", async () => {
  const chrome = JSON.parse(await readFile(root, "utf8"));

  assert.equal(chrome.manifest_version, 3);
  assert.equal(chrome.background.service_worker, "build/background.js");
  assert.equal("scripts" in chrome.background, false);
  assert.equal(chrome.content_scripts.length, 1, "static content-script entries must not overlap");
  const matches = chrome.content_scripts[0].matches;
  for (const match of matches) {
    assert.ok(!match.includes("://*"), `wildcard host in ${match}`);
    assert.ok(engineForUrl(match.replace("*://", "https://").replace("/*", "/search")));
  }
  for (const domain of GOOGLE_DOMAINS) {
    assert.ok(matches.includes(`*://${domain}/*`));
    assert.ok(matches.includes(`*://www.${domain}/*`));
  }
  assert.deepEqual(chrome.web_accessible_resources[0].resources, ["results/index.html"]);
  assert.ok(chrome.permissions.includes("scripting"));

  const firefox = firefoxManifest(chrome);
  assert.deepEqual(firefox.background, { scripts: ["build/background.js"] });
  assert.equal(firefox.browser_specific_settings.gecko.id, "{ba756ed5-9e80-4928-bdbb-057cfda28ab5}");
});
