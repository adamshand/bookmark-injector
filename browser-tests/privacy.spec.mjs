import { test, expect } from "./fixtures.mjs";

test("private results are readable only inside the extension frame; an unapproved embed cannot search", async ({ app }) => {
  await app.configure({ readeck: true });
  await app.page.goto(`${app.server.origin}/search?q=private`);
  const results = app.results();
  await expect(results.getByRole("link", { name: "Private Linkding private", exact: true })).toBeVisible();
  await expect(results.getByRole("link", { name: "Private Readeck private", exact: true })).toBeVisible();
  const host = await app.page.evaluate(() => {
    const frame = document.querySelector("iframe");
    let blocked = false;
    try { void frame.contentWindow.document.body; } catch (error) { blocked = error.name === "SecurityError"; }
    return { blocked, noDocument: frame.contentDocument === null,
      text: document.body.innerText, messages: JSON.stringify(window.receivedMessages), src: frame.src };
  });
  expect(host.blocked).toBe(true);
  expect(host.noDocument).toBe(true);
  for (const value of [host.text, host.messages]) {
    expect(value).not.toMatch(/Private Linkding|Private Readeck|Confidential|fixture-link-token|fixture-read-token/);
  }
  expect(app.server.requests).toHaveLength(2);
  const attacker = await app.context.newPage();
  await attacker.goto(`${app.server.unauthorizedOrigin}/search?q=private`);
  await expect(attacker.locator("iframe")).toHaveCount(0);
  await attacker.evaluate((src) => {
    const frame = document.createElement("iframe");
    frame.src = src;
    document.body.append(frame);
  }, host.src);
  await expect(attacker.frameLocator("iframe").getByText("Search disconnected. Reload the search page to retry.")).toBeVisible();
  expect(app.server.requests).toHaveLength(2);
});
