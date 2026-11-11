// Engines often rewrite tracking parameters or URL fragments after rendering.
// Search mode changes must also retire panels when switching to Images.
// Preserve missing vs empty q: a missing query can be a SearX POST search.
export function searchPageKey(value) {
  try {
    const url = new URL(value);
    return JSON.stringify([url.origin, url.pathname, url.searchParams.get("q")?.trim() ?? null,
      url.searchParams.get("udm"), url.searchParams.get("tbm")]);
  } catch { return null; }
}
