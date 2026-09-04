import { httpsBaseUrl, requestJson } from "./network.js";

export class LinkdingApi {
  constructor(configuration, fetcher) {
    this.baseUrl = httpsBaseUrl(configuration.baseUrl, "Linkding");
    this.token = configuration.token;
    this.fetcher = fetcher || globalThis.fetch.bind(globalThis);
  }

  async search(text, { limit = 100 } = {}) {
    const url = new URL(`${this.baseUrl}/api/bookmarks/`);
    url.searchParams.set("q", text);
    url.searchParams.set("limit", String(Math.min(100, Math.max(1, Number(limit) || 10))));
    const { response, body } = await requestJson(this.fetcher, url.toString(), {
      headers: { Authorization: `Token ${this.token}` },
    });
    if (response.status !== 200) {
      throw new Error(`Error searching Linkding: HTTP ${response.status}`);
    }

    const results = body.results.map((bookmark) => ({
      url: bookmark.url,
      savedUrl: bookmark.web_archive_snapshot_url || "",
      title: bookmark.title || bookmark.website_title || bookmark.url,
      description: bookmark.description || bookmark.website_description || "",
      tags: Array.isArray(bookmark.tag_names) ? bookmark.tag_names : [],
      note: "",
      annotations: [],
    }));
    const total = Number(body.count);
    return { results, total: Number.isFinite(total) ? total : results.length };
  }

  async testConnection() {
    try {
      const { response, body } = await requestJson(this.fetcher, `${this.baseUrl}/api/bookmarks/?limit=1`, {
        headers: { Authorization: `Token ${this.token}` },
      });
      return {
        success: response.status === 200 && Array.isArray(body?.results),
        status: response.status,
        message: response.status === 200 && Array.isArray(body?.results)
          ? "Connection successful" : `Connection failed (HTTP ${response.status})`,
      };
    } catch (error) {
      return { success: false, status: null, message: error.message || "Network error" };
    }
  }
}
