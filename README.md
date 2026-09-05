<p align="center">
  <img src="icons/bookmark-injector.png" alt="Bookmark Injector icon" width="180" height="180">
</p>

<h1 align="center">Bookmark Injector</h1>

<p align="center">
  Bring results from your self-hosted <a href="https://github.com/sissbruecker/linkding">Linkding</a>
  and <a href="https://readeck.org/">Readeck</a> libraries into everyday web searches.
</p>

> **Fork lineage:** Bookmark Injector is a fork of
> [Fivefold/linkding-injector](https://github.com/Fivefold/linkding-injector), originally created by
> Jakob Essbüchl. The upstream project provides the search-engine detection, sidebar placement,
> theming, and original Linkding integration on which this extension is built.

## What it does

When you search with Google, DuckDuckGo, Brave Search, Kagi, Qwant, or a compatible
SearX/SearXNG instance, Bookmark Injector searches your enabled bookmark services and adds matching
items to the results sidebar.

- Search Linkding, Readeck, or both.
- Interleave each service's ranked results in one panel.
- Open the original page by selecting its title.
- Open the saved Linkding or Readeck copy by selecting the service icon.
- Show labels, bookmark notes, highlights, and annotation notes.
- Link to the complete result set in each service.
- Continue showing results from one service if the other is unavailable.
- Follow each search engine's light or dark theme, with manual overrides available.

## What this fork adds

Compared with the original Linkding Injector, this fork adds:

### Readeck search

Readeck's full-text search covers bookmark titles, descriptions, extracted article text, sites,
labels, bookmark notes, and annotation notes. The extension displays at most the ten best Readeck
matches and links to the full search in Readeck.

Optional annotation enrichment loads highlights and notes after bookmark results appear. Each
search uses at most three annotation requests at a time, and overlapping searches share in-flight
requests without retaining stale annotation responses.

### Combined provider results

Linkding and Readeck are configured independently. When both are enabled, their results are
round-robin interleaved while preserving the ranking returned by each service. Provider icons make
the source clear and link directly to each service's saved copy.

### Reliability and browser compatibility

- Provider results appear progressively; a slow service does not block a healthy one.
- API requests, including response bodies, have a ten-second deadline. Annotation enrichment
  has a separate display deadline and never delays initial bookmarks.
- Results are returned to a tab-bound extension iframe, including overlapping searches.
- Back/forward-cache restores and client-side URL changes start fresh searches.
- Sidebar placement uses fallback selectors and bounded observers; duplicate initialization
  and blank queries do not generate duplicate or unfiltered searches.
- Chrome uses a Manifest V3 service worker.
- Firefox receives a generated, compatible background-script manifest during packaging.
- Existing Linkding Injector settings migrate automatically.

### Security hardening

- Both provider URLs and approved SearX origins must use HTTPS. API redirects are rejected;
  use the final instance URL rather than a redirecting alias.
- Credentials remain in extension storage and are used by the background worker for searches
  and the extension options page for connection tests.
- Private results render in a packaged extension-origin iframe. Search-page scripts cannot
  read its DOM; content scripts never receive bookmarks or tokens.
- Only exact supported engine hosts and explicitly approved SearX origins can initiate searches.
  The background checks the top-level sender, current tab URL, and one-use iframe attachment.
- Result text is escaped and result URLs are protocol-checked before insertion.
- Readeck searches are designed for a read-only bookmark token.

See [the security model](docs/security.md) for trust boundaries and remaining limitations.

## Configuration

Open the extension's options page and enable one or both providers.

### Linkding

Enter your HTTPS Linkding instance URL and API token. The configurable result limit applies to
Linkding (1–100). Existing HTTP configurations must be changed to HTTPS or disabled.

### Readeck

Enter your Readeck instance URL and a token restricted to bookmark read access. This extension does
not need permission to create, edit, archive, or delete bookmarks.

You can optionally disable highlight and annotation-note enrichment to make each search use only one
Readeck API request.

### SearX / SearXNG

Add trusted HTTPS instance URLs to **Approved instance URLs**, one per line. Approval covers the
origin (scheme, hostname, port), not an individual path. No instances are implicitly approved or
automatically migrated from previously visited pages. Reload search pages after saving.
See [SearX setup](docs/searx.md).

**Save** validates settings locally without contacting providers. You can save with both providers
disabled, or while a server is unavailable. **Test connections** is a separate, optional action.

## Install from source

Requirements: Node.js 24 LTS or newer and npm.

```sh
git clone https://github.com/adamshand/bookmark-injector.git
cd bookmark-injector
npm ci
npm test
npm run build
```

### Chrome

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the
repository directory. The root `manifest.json` is the Chrome development manifest.

### Firefox

Run:

```sh
./build.sh
```

The script tests and builds the extension, creates a Firefox-specific staging tree in
`dist/firefox`, runs `web-ext lint`, and writes the installable package to `web-ext-artifacts`.

## Development

```sh
npm ci                         # install exact dependencies
npm test                       # fast behavioral and provider-compatibility tests
npx playwright install chromium # one-time browser test setup
npm run test:browser            # build and test the actual extension in Chromium
npm run test:all                # both test suites
npm run build                  # build the unpacked Chrome extension
./build.sh                     # fast tests, lint, and package for Firefox
```

CI runs both suites and Firefox packaging lint. See [testing and the release checklist](docs/testing.md)
for focused runs, failure traces, provider-fixture provenance, and Firefox/live-engine checks.

Activate the repository-owned version hook once after cloning:

```sh
npm run hooks:install
```

Every commit then increments the patch version in `manifest.json`, `package.json`, and
`package-lock.json`. Git does not activate versioned hooks automatically, so this command is needed
for each checkout.

Provider clients and progressive orchestration live in `src/linkding.js`, `src/readeck.js`, and
`src/search.js`. `src/connections.js` enforces the controller/iframe trust boundary.
`src/engines.js` owns origin authorization; `src/placement.js` owns the small, engine-specific
selector lists. Placement can change without relaxing authorization. `src/searchInjection.js`
only manages search-page lifecycle and iframe layout; `src/results.js` renders private results.

## Permissions

Like the upstream extension, Bookmark Injector currently requests broad HTTP and HTTPS host access so
it can connect to arbitrary self-hosted instances. The `scripting` permission registers content
scripts for approved SearX hostnames; the background separately checks the exact origin and port.
Only the iframe HTML entry point is web-accessible. Optional per-instance API host permissions
remain a worthwhile improvement before broad store publication.

## Credits and license

Bookmark Injector is MIT licensed; see [LICENSE](LICENSE).

This project builds on:

- [Fivefold/linkding-injector](https://github.com/Fivefold/linkding-injector), created by Jakob
  Essbüchl.
- Code adapted there from Sascha Ißbrücker's
  [official Linkding extension](https://github.com/sissbruecker/linkding-extension).

The Readeck service icon is © 2021 Olivier Meunier and distributed under AGPL-3.0-only. Its source
and license metadata are recorded in `icons/readeck.svg.license`.
