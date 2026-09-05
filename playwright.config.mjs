import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "**/*.spec.mjs",
  timeout: 30000,
  expect: { timeout: 7000 },
  // Each case gets its own extension profile and local server. Keep local runs
  // lightweight; failures are not retried into a misleading green result.
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/browser",
});
