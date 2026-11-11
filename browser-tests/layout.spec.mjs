import { test, expect } from "./fixtures.mjs";

test("Google Images hides the panel, including client-side mode switches", async ({ app }) => {
  await app.configure();
  const frame = app.page.locator('iframe[title="Private bookmark search results"]');
  for (const mode of ["udm=2", "tbm=isch"]) {
    await app.page.goto(`https://www.google.com/search?q=layout&${mode}`);
    await app.page.waitForTimeout(1200);
    await expect(frame).toHaveCount(0);
    await app.page.evaluate(() => history.pushState({}, "", "/search?q=layout"));
    await expect(frame).toBeVisible();
    await app.page.evaluate((mode) => history.pushState({}, "", `/search?q=layout&${mode}`), mode);
    await expect(frame).toHaveCount(0);
  }
});

for (const theme of ["light", "dark"]) {
  test(`Google ${theme} results fill their frame at narrow/wide widths and grow when annotations arrive`, async ({ app }) => {
    await app.configure({ readeck: true, annotations: true, googleTheme: theme });
    // Manual selection must work even when it disagrees with the OS preference.
    await app.page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
    const release = app.server.hold("annotations", "layout");
    await app.page.goto("https://www.google.com/search?q=layout&theme=dark&width=372");
    const results = app.results();
    const frame = app.page.locator('iframe[title="Private bookmark search results"]');
    await expect(results.getByRole("link", { name: "Private Readeck layout", exact: true })).toBeVisible();
    await app.server.waitForRequest("annotations", "layout");
    await expect(frame).toHaveCSS("color-scheme", theme);
    const initialHeight = (await frame.boundingBox()).height;
    release();
    await expect(results.getByText("Highlighted layout", { exact: true })).toBeVisible();
    await expect.poll(async () => (await frame.boundingBox()).height).toBeGreaterThan(initialHeight);

    for (const width of [240, 300, 360, 420]) {
      await app.page.locator("#rhs").evaluate((sidebar, width) => { sidebar.style.width = `${width}px`; }, width);
      await expect(frame).toHaveCSS("width", `${width}px`);
      // Cross-process iframe viewports resize asynchronously after the host box.
      await expect.poll(() => results.getByRole("main").evaluate(
        (main) => main.firstElementChild.getBoundingClientRect().width,
      )).toBe(width);
      const panel = await results.getByRole("main").evaluate((main) => ({
        width: main.firstElementChild.getBoundingClientRect().width,
        height: main.firstElementChild.getBoundingClientRect().height,
        radius: getComputedStyle(main.firstElementChild).borderRadius,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const header = await results.locator("#navbar").evaluate((nav) => {
        const logo = nav.querySelector("#ld-logo").getBoundingClientRect();
        const count = nav.querySelector("#results_amount").getBoundingClientRect();
        const settings = nav.querySelector("#ld-options").getBoundingClientRect();
        const title = nav.querySelector("h1");
        return { logoBottom: logo.bottom, countTop: count.top, settingsTop: settings.top,
          countBottom: count.bottom, titleWrap: getComputedStyle(title).overflowWrap };
      });
      expect(header.titleWrap).toBe("normal");
      if (width <= 360) {
        expect(header.countTop).toBeGreaterThanOrEqual(header.logoBottom);
        expect(header.settingsTop).toBeLessThan(header.countTop);
      }
      expect(panel.width).toBe(width);
      expect(panel.scrollWidth).toBe(width);
      expect(panel.scheme).toBe(theme);
      await expect(frame).toHaveCSS("border-radius", panel.radius);
      await expect.poll(async () => Math.abs((await frame.boundingBox()).height - panel.height)).toBeLessThanOrEqual(1);
    }
  });
}
