export function getBrowser() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  throw new Error("Browser extension API not found");
}

export function getStorage() {
  return getBrowser().storage.local;
}

export function guardPort(port, runtime) {
  let connected = true;
  port.onDisconnect.addListener(() => {
    connected = false;
    void runtime.lastError;
  });
  return {
    postMessage(message) {
      if (!connected) return;
      try { port.postMessage(message); } catch {
        // A port may close before its onDisconnect listener is dispatched.
        connected = false;
        void runtime.lastError;
      }
    },
  };
}

export function openOptions() {
  getBrowser().runtime.openOptionsPage();
}
