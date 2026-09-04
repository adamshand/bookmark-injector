import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { firefoxManifest } from "../src/manifests.js";

const root = new URL("../manifest.json", import.meta.url);

test("the unpacked manifest is valid MV3 for Chrome and derives a Firefox background", async () => {
  const chrome = JSON.parse(await readFile(root, "utf8"));

  assert.equal(chrome.manifest_version, 3);
  assert.equal(chrome.background.service_worker, "build/background.js");
  assert.equal("scripts" in chrome.background, false);

  const firefox = firefoxManifest(chrome);
  assert.deepEqual(firefox.background, { scripts: ["build/background.js"] });
  assert.equal(firefox.browser_specific_settings.gecko.id, "{ba756ed5-9e80-4928-bdbb-057cfda28ab5}");
});
