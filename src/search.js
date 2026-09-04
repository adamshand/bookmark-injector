function fullSearchUrl(configuration, term, parameter) {
  const url = new URL(`${configuration.baseUrl.replace(/\/+$/, "")}/bookmarks`);
  url.searchParams.set(parameter, term);
  return url.toString();
}

function publicConfiguration(config) {
  return Object.fromEntries([
    "showLogo", "openLinkType", "themeGoogle", "themeDuckduckgo", "themeBrave",
    "themeSearx", "themeKagi", "themeQwant",
  ].map((key) => [key, config[key]]));
}

async function deadline(task, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Request timed out")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// This port must belong to a validated extension iframe, never a content script.
export function createSearchHandler({ getConfiguration, makeLinkding, makeReadeck,
  timeoutMs = 12000, enrichmentTimeoutMs = 15000 }) {
  return async function handleSearch(port, request) {
    if (typeof request.searchTerm !== "string" || !request.searchTerm.trim()) return;
    const term = request.searchTerm.trim().slice(0, 2000);
    const config = await getConfiguration();
    const definitions = [
      ["linkding", makeLinkding, "q"],
      ["readeck", makeReadeck, "search"],
    ].filter(([source]) => config[source]?.enabled);
    const found = new Map();
    const warnings = new Map();
    const send = (done = false) => port.postMessage({
      providers: definitions.map(([source]) => found.get(source)).filter(Boolean),
      warnings: [...warnings.values()],
      config: publicConfiguration(config),
      done,
      ...(!definitions.length ? { message: "No bookmark service is enabled. Configure one in options." } : {}),
    });
    send();
    await Promise.all(definitions.map(async ([source, makeApi, parameter]) => {
      const provider = config[source];
      let api;
      try {
        const results = await deadline(async () => {
          if (!provider.baseUrl || !provider.token) throw new Error("Missing URL or API token");
          api = makeApi(provider);
          return api.search(term, { limit: source === "readeck" ? 10 : config.resultNum });
        }, timeoutMs);
        found.set(source, {
          ...results, source, fullSearchUrl: fullSearchUrl(provider, term, parameter),
        });
        send();
      } catch {
        // Do not forward arbitrary server/error strings, which may contain secrets.
        warnings.set(source, `${source === "readeck" ? "Readeck" : "Linkding"} search failed or timed out. Check its connection in options.`);
        send();
        return;
      }
      if (source === "readeck" && provider.enrichAnnotations) {
        try {
          const results = await deadline(
            () => api.enrichAnnotations(found.get(source).results, term), enrichmentTimeoutMs,
          );
          found.set(source, { ...found.get(source), results });
          send();
        } catch {
          warnings.set("annotations", "Readeck highlights could not be loaded; bookmark results are still available.");
          send();
        }
      }
    }));
    send(true);
  };
}
