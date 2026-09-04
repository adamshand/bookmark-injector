export function getBrowser() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  throw new Error("Browser extension API not found");
}

export function getStorage() {
  return getBrowser().storage.local;
}

export function openOptions() {
  getBrowser().runtime.openOptionsPage();
}
