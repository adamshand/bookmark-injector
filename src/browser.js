export function getBrowser() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  throw new Error("Browser extension API not found");
}

export function getStorage() {
  return getBrowser().storage.local;
}

export function isContextInvalidated(error) {
  return /extension context invalidated/i.test(error?.message || "");
}

function consumePortError(runtime) {
  try { void runtime.lastError; } catch (error) {
    // Even reading lastError can fail in an old content-script context.
    if (!isContextInvalidated(error)) throw error;
  }
}

export function guardPort(port, runtime) {
  let connected = true;
  port.onDisconnect.addListener(() => {
    connected = false;
    consumePortError(runtime);
  });
  return {
    postMessage(message) {
      if (!connected) return;
      try { port.postMessage(message); } catch {
        // A port may close before its onDisconnect listener is dispatched.
        connected = false;
        consumePortError(runtime);
      }
    },
  };
}

export function openOptions() {
  getBrowser().runtime.openOptionsPage();
}
