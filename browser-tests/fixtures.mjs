import { test as base, expect, chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { startFixtureServer, searchHtml } from "./server.mjs";

const extensionPath = fileURLToPath(new URL("../", import.meta.url));

// Spectre paints a custom checkbox/radio over the native input. Use real
// keyboard interaction instead of force-clicking through that decoration.
export async function setChecked(control, checked = true) {
  if ((await control.isChecked()) !== checked) await control.press("Space");
  await expect(control).toBeChecked({ checked });
}

export const test = base.extend({
  app: async ({}, use, testInfo) => {
    const server = await startFixtureServer();
    const profile = testInfo.outputPath("profile");
    let context;
    try {
      context = await chromium.launchPersistentContext(profile, {
        channel: "chromium", headless: !process.env.HEADED,
        viewport: { width: 1000, height: 800 },
        ignoreHTTPSErrors: true,
        args: [
          `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`,
          // Only this disposable test browser trusts the checked-in loopback certificate.
          "--ignore-certificate-errors",
        ],
      });
      await context.tracing.start({ screenshots: true, snapshots: true });
      const errors = [];
      context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "www.google.com" && url.pathname === "/search") {
          await route.fulfill({ contentType: "text/html", body: searchHtml({
            dark: url.searchParams.get("theme") === "dark",
            width: Number(url.searchParams.get("width")) || 372,
          }) });
        } else if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "chrome-extension:") {
          await route.continue();
        } else {
          // Never depend on a live search engine, external article, or analytics.
          await route.abort();
        }
      });
      const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
      const extensionId = new URL(worker.url()).hostname;
      const optionsUrl = `chrome-extension://${extensionId}/options/index.html`;
      const options = await context.newPage();
      await options.goto(optionsUrl);
      await expect(options.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      const page = await context.newPage();
      const app = {
        context, server, page, options, optionsUrl, extensionId,
        results: () => page.frameLocator('iframe[title="Private bookmark search results"]'),
        async configure({ readeck = false, annotations = false, sameTab = false, googleTheme = "auto" } = {}) {
          await setChecked(options.getByRole("checkbox", { name: "Search Linkding", exact: true }));
          await options.locator("#input-linkding-url").fill(`${server.origin}/linkding`);
          await options.getByLabel("API token", { exact: true }).fill("fixture-link-token");
          if (readeck) {
            await setChecked(options.getByRole("checkbox", { name: "Search Readeck", exact: true }));
            await options.locator("#input-readeck-url").fill(`${server.origin}/readeck`);
            await options.getByLabel("Read-only API token", { exact: true }).fill("fixture-read-token");
          }
          await setChecked(options.getByRole("checkbox", { name: "Show highlights and notes for the first 10 matches" }), annotations);
          await options.getByLabel("Approved instance URLs").fill(server.origin);
          if (sameTab || googleTheme !== "auto") {
            await options.getByText("Advanced Settings", { exact: true }).click();
            if (sameTab) await setChecked(options.getByRole("radio", { name: "Open links in the same tab", exact: true }));
            await setChecked(options.locator(`#google-${googleTheme}`));
          }
          await options.getByRole("button", { name: "Save", exact: true }).click();
          await expect(options.getByRole("status")).toContainText("Settings saved");
          // Synchronize setup with browser-managed registration, not an arbitrary delay.
          await expect.poll(() => options.evaluate(async () =>
            (await chrome.scripting.getRegisteredContentScripts()).flatMap((script) => script.matches),
          )).toContain("https://127.0.0.1/*");
        },
      };
      await use(app);
      expect(errors, "uncaught errors in extension or fixture pages").toEqual([]);
    } finally {
      if (context) {
        if (testInfo.status !== testInfo.expectedStatus) {
          await context.tracing.stop({ path: testInfo.outputPath("trace.zip") });
          for (const [index, page] of context.pages().entries()) {
            if (!page.isClosed()) await page.screenshot({ path: testInfo.outputPath(`page-${index}.png`) }).catch(() => {});
          }
        } else await context.tracing.stop();
        await context.close();
      }
      await server.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});
export { expect };
