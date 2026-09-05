import { test, expect } from "./fixtures.mjs";

test("same-tab links navigate the tab and back navigation restores working results", async ({ app }) => {
  await app.configure({ sameTab: true });
  const searchUrl = `${app.server.origin}/search?q=navigation`;
  await app.page.goto(searchUrl);
  await app.results().getByRole("link", { name: "Private Linkding navigation", exact: true }).click();
  await expect(app.page).toHaveURL(`${app.server.origin}/article/navigation`);
  await expect(app.page.getByRole("heading", { name: "Original article" })).toBeVisible();
  await app.page.goBack();
  await expect(app.page).toHaveURL(searchUrl);
  await expect(app.results().getByRole("link", { name: "Private Linkding navigation", exact: true })).toBeVisible();
  await app.page.evaluate(() => {
    history.pushState({}, "", "/search?q=after-back");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(app.results().getByRole("link", { name: "Private Linkding after-back", exact: true })).toBeVisible();
});
