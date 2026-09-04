import { httpsBaseUrl, requestJson } from "./network.js";

const DEFAULT_LIMIT = 10;
const annotationRequests = new Map();

export class ReadeckApi {
  constructor(configuration, fetcher) {
    this.baseUrl = httpsBaseUrl(configuration.baseUrl, "Readeck");
    this.token = configuration.token;
    this.fetcher = fetcher || globalThis.fetch.bind(globalThis);
  }

  async search(text, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 1), DEFAULT_LIMIT);
    const url = new URL(`${this.baseUrl}/api/bookmarks`);
    url.searchParams.set("search", text);
    url.searchParams.set("limit", String(limit));
    const { response, body: bookmarks } = await requestJson(this.fetcher, url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
      // Readeck responses are marked private and may otherwise be reused from
      // the browser's HTTP cache after bookmarks or annotations change.
      cache: "no-store",
    });
    if (response.status !== 200) {
      throw new Error(`Error searching Readeck: HTTP ${response.status}`);
    }
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
    const totalHeader = response.headers.get("Total-Count");
    const total = totalHeader === null ? NaN : Number(totalHeader);
    return { results, total: Number.isFinite(total) ? total : results.length };
  }

  async testConnection() {
    try {
      const { response, body } = await requestJson(this.fetcher, `${this.baseUrl}/api/bookmarks?limit=1`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (response.status === 200) {
        if (Array.isArray(body)) {
          return { success: true, status: 200, message: "Connection successful" };
        }
      }
      return {
        success: false,
        status: response.status,
        message: `Connection failed (HTTP ${response.status})`,
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
      const request = requestJson(this.fetcher,
        `${this.baseUrl}/api/bookmarks/${encodeURIComponent(bookmarkId)}/annotations`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
          cache: "no-store",
        },
      ).then(({ response, body: annotations }) => {
        if (response.status !== 200) {
          throw new Error(`Error loading Readeck annotations: HTTP ${response.status}`);
        }
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
