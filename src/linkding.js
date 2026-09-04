export class LinkdingApi {
  constructor(configuration, fetcher) {
    this.baseUrl = configuration.baseUrl.replace(/\/+$/, "");
    this.token = configuration.token;
    this.fetcher = fetcher || globalThis.fetch.bind(globalThis);
  }

  async search(text, { limit = 100 } = {}) {
    const url = new URL(`${this.baseUrl}/api/bookmarks/`);
    url.searchParams.set("q", text);
    url.searchParams.set("limit", String(limit));
    const response = await this.fetcher(url.toString(), {
      headers: { Authorization: `Token ${this.token}` },
    });
    if (response.status !== 200) {
      throw new Error(`Error searching Linkding: ${response.statusText}`);
    }

    const body = await response.json();
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
      const response = await this.fetcher(`${this.baseUrl}/api/bookmarks/?limit=1`, {
        headers: { Authorization: `Token ${this.token}` },
      });
      if (response.status === 200) {
        const body = await response.json();
        if (Array.isArray(body.results)) {
          return { success: true, status: 200, message: "Connection successful" };
        }
      }

      let message = response.statusText || "Connection failed";
      try {
        const body = await response.json();
        message = body.detail || body.message || message;
      } catch {
        // Keep the HTTP status text when the error body is not JSON.
      }
      return { success: false, status: response.status, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      return {
        success: false,
        status: null,
        message: ["Failed to fetch", "NetworkError when attempting to fetch resource."].includes(
          message,
        )
          ? "Network error - unable to reach server"
          : message,
      };
    }
  }
}
