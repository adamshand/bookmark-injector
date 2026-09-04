export const REQUEST_TIMEOUT_MS = 10000;

export function httpsBaseUrl(value, service = "Bookmark service") {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${service} requires an HTTPS URL without embedded credentials`);
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

// Include body consumption in the deadline: headers arriving is not enough.
export async function requestJson(fetcher, url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const response = await fetcher(url, {
          ...options,
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          // Never forward credentials along redirects, including HTTPS → HTTP.
          redirect: "error",
        });
        const body = response.status === 200 ? await response.json() : null;
        return { response, body };
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Request timed out"));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
