import { test, expect, setChecked } from "./fixtures.mjs";

test("both providers can be disabled, saved, and remain disabled when options reopen", async ({ app }) => {
  await app.configure({ readeck: true });
  for (const name of ["Search Linkding", "Search Readeck"]) {
    await setChecked(app.options.getByRole("checkbox", { name, exact: true }), false);
  }
  await app.options.getByRole("button", { name: "Save", exact: true }).click();
  await expect(app.options.getByRole("status")).toContainText("Settings saved");
  await app.options.close();
  const reopened = await app.context.newPage();
  await reopened.goto(app.optionsUrl);
  await expect(reopened.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  for (const name of ["Search Linkding", "Search Readeck"]) {
    await expect(reopened.getByRole("checkbox", { name, exact: true })).not.toBeChecked();
  }
  expect(app.server.requests).toEqual([]);
});

test("a failed connection test does not prevent saving settings while a provider is offline", async ({ app }) => {
  app.server.offline.add("linkding");
  await app.configure();
  expect(app.server.requests).toEqual([]);
  await app.options.getByRole("button", { name: "Test connections", exact: true }).click();
  await expect(app.options.getByText("Linkding: Connection failed (HTTP 503)")).toBeVisible();
  await app.options.getByRole("spinbutton", { name: "Maximum results" }).fill("7");
  await app.options.getByRole("button", { name: "Save", exact: true }).click();
  await expect(app.options.getByRole("status")).toContainText("Settings saved");
  await app.options.reload();
  await expect(app.options.getByRole("spinbutton", { name: "Maximum results" })).toHaveValue("7");
  await expect(app.options.getByRole("checkbox", { name: "Search Linkding", exact: true })).toBeChecked();
  expect(app.server.requests).toHaveLength(1);
});

test("storage failure is shown as an error and does not pretend changed settings were saved", async ({ app }) => {
  await app.configure();
  // Inject failure only at the browser storage boundary, not into application
  // modules. Simulate Chrome's callback/lastError API (including its short lifetime).
  await app.options.evaluate(() => {
    chrome.storage.local.set = (_values, callback) => {
      Object.defineProperty(chrome.runtime, "lastError", {
        configurable: true, get: () => ({ message: "Simulated storage quota exceeded" }),
      });
      try { callback(); } finally { delete chrome.runtime.lastError; }
    };
  });
  await app.options.getByRole("spinbutton", { name: "Maximum results" }).fill("7");
  await app.options.getByRole("button", { name: "Save", exact: true }).click();
  await expect(app.options.getByRole("status")).toHaveText("Simulated storage quota exceeded");
  await expect(app.options.getByRole("status")).not.toContainText("Settings saved");
  await app.options.reload();
  await expect(app.options.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await expect(app.options.getByRole("spinbutton", { name: "Maximum results" })).toHaveValue("10");
});
