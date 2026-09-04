const DEFAULT_LIMIT = 10;
const annotationRequests = new Map();

function baseUrlOf(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Readeck requires an HTTPS URL");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export class ReadeckApi {
  constructor(configuration, fetcher) {
    this.baseUrl = baseUrlOf(configuration.baseUrl);
    this.token = configuration.token;
    this.fetcher = fetcher || globalThis.fetch.bind(globalThis);
  }

  async search(text, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 1), DEFAULT_LIMIT);
    const url = new URL(`${this.baseUrl}/api/bookmarks`);
    url.searchParams.set("search", text);
    url.searchParams.set("limit", String(limit));
    const response = await this.fetcher(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
      // Readeck responses are marked private and may otherwise be reused from
      // the browser's HTTP cache after bookmarks or annotations change.
      cache: "no-store",
    });
    if (response.status !== 200) {
      throw new Error(`Error searching Readeck: ${response.statusText}`);
    }
    const bookmarks = await response.json();
    const results = bookmarks.map((bookmark) => ({
      id: bookmark.id,
      url: bookmark.url,
      savedUrl: `${this.baseUrl}/bookmarks/${bookmark.id}`,
      title: bookmark.title || bookmark.url,
      description: bookmark.description || "",
      tags: Array.isArray(bookmark.labels) ? bookmark.labels : [],
      note: bookmark.note || "",
      annotations: [],
    }));
    const total = Number(response.headers.get("Total-Count"));
    return { results, total: Number.isFinite(total) ? total : results.length };
  }

  async testConnection() {
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/bookmarks?limit=1`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (response.status === 200) {
        const body = await response.json();
        if (Array.isArray(body)) {
          return { success: true, status: 200, message: "Connection successful" };
        }
      }
      return {
        success: false,
        status: response.status,
        message: response.statusText || "Connection failed",
      };
    } catch (error) {
      return {
        success: false,
        status: null,
        message: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  async annotations(bookmarkId) {
    const requestKey = `${this.baseUrl}\0${this.token}\0${bookmarkId}`;
    if (!annotationRequests.has(requestKey)) {
      const request = this.fetcher(
        `${this.baseUrl}/api/bookmarks/${encodeURIComponent(bookmarkId)}/annotations`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
          cache: "no-store",
        },
      ).then(async (response) => {
        if (response.status !== 200) {
          throw new Error(`Error loading Readeck annotations: ${response.statusText}`);
        }
        const annotations = await response.json();
        return annotations.map((annotation) => ({
          text: annotation.text || "",
          note: annotation.note || "",
        }));
      });
      annotationRequests.set(requestKey, request);
    }

    const request = annotationRequests.get(requestKey);
    try {
      return await request;
    } catch {
      return [];
    } finally {
      if (annotationRequests.get(requestKey) === request) {
        annotationRequests.delete(requestKey);
      }
    }
  }

  async enrichAnnotations(results, searchText) {
    const enriched = results.map((result) => ({ ...result }));
    const query = String(searchText ?? "").trim().toLocaleLowerCase();
    if (!query) return enriched;

    const queue = enriched.slice(0, DEFAULT_LIMIT);
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const index = next;
        next += 1;
        const annotations = await this.annotations(queue[index].id);
        queue[index].annotations = annotations.filter((annotation) =>
          `${annotation.text}\n${annotation.note}`.toLocaleLowerCase().includes(query),
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    return enriched;
  }
}
