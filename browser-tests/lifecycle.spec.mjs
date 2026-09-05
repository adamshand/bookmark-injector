import { test, expect } from "./fixtures.mjs";

test("tracking rewrites retain the iframe; a new query cannot display late results from the previous search", async ({ app }) => {
  await app.configure({ readeck: true });
  const releaseFirst = app.server.hold("readeck", "first");
  await app.page.goto(`${app.server.origin}/search?q=first`);
  await expect(app.results().getByRole("link", { name: "Private Linkding first", exact: true })).toBeVisible();
  const pending = await app.server.waitForRequest("readeck", "first");
  const frame = app.page.locator('iframe[title="Private bookmark search results"]');
  const originalChannel = await frame.getAttribute("src");
  await app.page.evaluate(() => {
    history.replaceState({}, "", "/search?q=first&tracking=changed#results");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(frame).toHaveAttribute("src", originalChannel);
  expect(app.server.requests).toHaveLength(2);

  // Observe completion of the old response, not a guessed sleep interval.
  const oldResponse = app.context.waitForEvent("response", (response) => response.url() === pending.url);
  await app.page.evaluate(() => {
    history.pushState({}, "", "/search?q=second");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(app.results().getByRole("link", { name: "Private Readeck second", exact: true })).toBeVisible();
  await expect(frame).not.toHaveAttribute("src", originalChannel);
  releaseFirst();
  await (await oldResponse).finished();
  await app.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(app.results().locator("main")).not.toContainText("first");
  await expect(app.results().getByRole("link", { name: "Private Linkding second", exact: true })).toBeVisible();
  expect(app.server.requests.map(({ source, term }) => `${source}:${term}`).sort()).toEqual([
    "linkding:first", "linkding:second", "readeck:first", "readeck:second",
  ]);
});
