function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "moz-extension:", "chrome-extension:"].includes(url.protocol)
      ? escapeHTML(url.toString())
      : "#";
  } catch {
    return "#";
  }
}

function bounded(value, length = 280) {
  const text = String(value ?? "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function providerName(source) {
  return source === "readeck" ? "Readeck" : "Linkding";
}

function resultHtml(bookmark, openLinkType, sourceIcons) {
  const target = openLinkType === "sameTab" ? "_self" : "_blank";
  const tags = (bookmark.tags || [])
    .map((tag) => `<span>#${escapeHTML(tag)}</span>`)
    .join(" ");
  const note = bounded(bookmark.note);
  const annotations = (bookmark.annotations || [])
    .filter((annotation) => annotation.note || annotation.text)
    .slice(0, 2)
    .map((annotation) => {
      const selected = bounded(annotation.text, 180);
      const annotationNote = bounded(annotation.note, 280);
      return `<blockquote class="bookmark-annotation">${
        selected ? `<div>${escapeHTML(selected)}</div>` : ""
      }${annotationNote ? `<strong>${escapeHTML(annotationNote)}</strong>` : ""}</blockquote>`;
    })
    .join("");
  const source = bookmark.source === "readeck" ? "readeck" : "linkding";
  const service = providerName(source);
  const icon = `<img src="${safeUrl(sourceIcons[source])}" alt="${service}" />`;
  const sourceIcon = bookmark.savedUrl
    ? `<a class="source-copy ${source}" href="${safeUrl(bookmark.savedUrl)}" target="_blank" rel="noopener" title="Open ${service} saved copy">${icon}</a>`
    : `<span class="source-copy ${source}" title="No ${service} saved copy is available">${icon}</span>`;

  return `<li>
    <div class="title">${sourceIcon}<a href="${safeUrl(bookmark.url)}" target="${target}" rel="noopener">${escapeHTML(bookmark.title)}</a></div>
    <div class="result-details">
      <div class="description">
        ${tags ? `<span class="tags">${tags}</span> | ` : ""}${escapeHTML(bookmark.description || "")}
      </div>
      ${note ? `<div class="bookmark-note">${escapeHTML(note)}</div>` : ""}
      ${annotations}
    </div>
  </li>`;
}

export function interleaveProviderResults(providers) {
  const results = [];
  const longest = Math.max(0, ...providers.map((provider) => provider.results.length));
  for (let rank = 0; rank < longest; rank += 1) {
    for (const provider of providers) {
      if (provider.results[rank]) {
        results.push({ ...provider.results[rank], source: provider.source });
      }
    }
  }
  return results;
}

function providerFooter(provider) {
  if (provider.total <= provider.results.length) return "";
  const name = providerName(provider.source);
  return `<a class="provider-footer ${escapeHTML(provider.source)}" href="${safeUrl(provider.fullSearchUrl)}" target="_blank" rel="noopener">View all ${provider.total} results in ${name} →</a>`;
}

export function buildResultsPanelHtml({
  searchEngine,
  themeClass,
  openLinkType,
  showLogo,
  logoUrl,
  optionsUrl,
  sourceIcons,
  providers,
}) {
  const results = interleaveProviderResults(providers);
  const count = results.length;
  return `<div id="bookmark-list-container" class="${escapeHTML(searchEngine)} ${escapeHTML(themeClass)}">
    <div id="navbar">
      <div id="ld-logo">${showLogo ? `<img src="${safeUrl(logoUrl)}" />` : ""}<h1>bookmark injector</h1></div>
      <div id="results_amount">Found <span>${count}</span> ${count === 1 ? "result" : "results"}.</div>
      <a id="ld-options" class="openOptions"><img class="ld-settings" src="${safeUrl(optionsUrl)}" /></a>
    </div>
    <ul class="bookmark-list ${escapeHTML(themeClass)}">${results
      .map((bookmark) => resultHtml(bookmark, openLinkType, sourceIcons))
      .join("")}</ul>
    ${providers.map(providerFooter).join("")}
  </div>`;
}
