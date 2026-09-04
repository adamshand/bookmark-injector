import assert from "node:assert/strict";
import test from "node:test";

import {
  getConfiguration,
  normalizeConfiguration,
  saveConfiguration,
} from "../src/configuration.js";

test("legacy Linkding settings migrate without enabling Readeck", () => {
  const config = normalizeConfiguration({
    baseUrl: "https://links.example",
    token: "old-token",
    resultNum: 7,
    showLogo: false,
  });

  assert.deepEqual(config.linkding, {
    enabled: true,
    baseUrl: "https://links.example",
    token: "old-token",
  });
  assert.deepEqual(config.readeck, {
    enabled: false,
    baseUrl: "",
    token: "",
    enrichAnnotations: true,
  });
  assert.equal(config.resultNum, 7);
  assert.equal(config.showLogo, false);
  assert.equal("baseUrl" in config, false);
  assert.equal("token" in config, false);
});

test("Linkding and Readeck are independently configurable", () => {
  const config = normalizeConfiguration({
    linkding: { enabled: false, baseUrl: "", token: "" },
    readeck: {
      enabled: true,
      baseUrl: "https://read.example",
      token: "read-token",
      enrichAnnotations: false,
    },
  });

  assert.equal(config.linkding.enabled, false);
  assert.equal(config.readeck.enabled, true);
  assert.equal(config.readeck.enrichAnnotations, false);
});

test("provider configuration saves and loads through extension storage", async () => {
  const values = {};
  const storage = {
    get(key, callback) {
      callback({ [key]: values[key] });
    },
    set(update, callback) {
      Object.assign(values, update);
      callback?.();
    },
  };
  const expected = normalizeConfiguration({
    linkding: { enabled: false },
    readeck: {
      enabled: true,
      baseUrl: "https://read.example",
      token: "read-token",
      enrichAnnotations: true,
    },
  });

  await saveConfiguration(expected, storage);
  const loaded = await getConfiguration(storage);

  assert.deepEqual(loaded, expected);
});
