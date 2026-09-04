function fullSearchUrl(configuration, term, parameter) {
  const url = new URL(`${configuration.baseUrl.replace(/\/+$/, "")}/bookmarks`);
  url.searchParams.set(parameter, term);
  return url.toString();
}

function isConfigured(provider) {
  return provider.enabled && provider.baseUrl && provider.token;
}

function publicConfiguration(config) {
  return {
    showLogo: config.showLogo,
    openLinkType: config.openLinkType,
    themeGoogle: config.themeGoogle,
    themeDuckduckgo: config.themeDuckduckgo,
    themeBrave: config.themeBrave,
    themeSearx: config.themeSearx,
    themeKagi: config.themeKagi,
    themeQwant: config.themeQwant,
  };
}

export function createSearchHandler({ getConfiguration, makeLinkding, makeReadeck }) {
  return async function handleSearch(port, request) {
    const config = await getConfiguration();
    const searches = [];

    if (isConfigured(config.linkding)) {
      searches.push(
        makeLinkding(config.linkding)
          .search(request.searchTerm, { limit: config.resultNum })
          .then((found) => ({
            source: "linkding",
            fullSearchUrl: fullSearchUrl(config.linkding, request.searchTerm, "q"),
            ...found,
          })),
      );
    }

    if (isConfigured(config.readeck)) {
      const api = makeReadeck(config.readeck);
      searches.push(
        api.search(request.searchTerm, { limit: 10 }).then(async (found) => ({
          source: "readeck",
          fullSearchUrl: fullSearchUrl(config.readeck, request.searchTerm, "search"),
          ...found,
          results: config.readeck.enrichAnnotations
            ? await api.enrichAnnotations(found.results, request.searchTerm)
            : found.results,
        })),
      );
    }

    const publicConfig = publicConfiguration(config);
    if (searches.length === 0) {
      port.postMessage({
        message:
          "No bookmark service is configured yet. " +
          "Please configure the extension in the <a class='openOptions'>options</a>.",
        config: publicConfig,
      });
      return;
    }

    const settled = await Promise.allSettled(searches);
    port.postMessage({
      providers: settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value),
      warnings: settled
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        ),
      config: publicConfig,
    });
  };
}
