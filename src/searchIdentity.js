// Engines often rewrite tracking parameters or URL fragments after rendering.
// Only a different origin, route, or query warrants a new bookmark search.
// Preserve missing vs empty q: a missing query can be a SearX POST search.
export function searchPageKey(value) {
  try {
    const url = new URL(value);
    return JSON.stringify([url.origin, url.pathname, url.searchParams.get("q")?.trim() ?? null]);
  } catch { return null; }
}
