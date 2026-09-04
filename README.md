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

Optional annotation enrichment loads highlights and notes for those matches. Requests are limited
to three at a time, and the 100 most recent annotation results are cached for the lifetime of the
background worker.

### Combined provider results

Linkding and Readeck are configured independently. When both are enabled, their results are
round-robin interleaved while preserving the ranking returned by each service. Provider icons make
the source clear and link directly to each service's saved copy.

### Reliability and browser compatibility

- Provider requests run concurrently and fail independently.
- Results are returned to the correct browser tab, including overlapping searches.
- Back/forward-cache port closures are handled without noisy Chromium console errors.
- Chrome uses a Manifest V3 service worker.
- Firefox receives a generated, compatible background-script manifest during packaging.
- Existing Linkding Injector settings migrate automatically.

### Security hardening

- Readeck instance URLs must use HTTPS.
- Credentials remain in extension storage and are used only by the background worker.
- Tokens are never included in messages sent to search-page content scripts.
- Result text is escaped and result URLs are protocol-checked before insertion.
- Readeck searches are designed for a read-only bookmark token.

## Configuration

Open the extension's options page and enable one or both providers.

### Linkding

Enter your Linkding instance URL and API token. The configurable result limit applies to Linkding.

### Readeck

Enter your Readeck instance URL and a token restricted to bookmark read access. This extension does
not need permission to create, edit, archive, or delete bookmarks.

You can optionally disable highlight and annotation-note enrichment to make each search use only one
Readeck API request.

## Install from source

Requirements: a supported Node.js LTS release and npm.

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
npm ci          # install exact dependencies
npm test        # run behavioral tests
npm run build   # build the unpacked Chrome extension
./build.sh      # test, lint, and package for Firefox
```

Activate the repository-owned version hook once after cloning:

```sh
npm run hooks:install
```

Every commit then increments the patch version in `manifest.json`, `package.json`, and
`package-lock.json`. Git does not activate versioned hooks automatically, so this command is needed
for each checkout.

Provider clients and orchestration live in `src/linkding.js`, `src/readeck.js`, and `src/search.js`.
Search-engine detection and sidebar placement remain in `src/searchInjection.js`. That brittle,
search-engine-specific code deliberately stays close to upstream so future fixes can be merged.

## Permissions

Like the upstream extension, Bookmark Injector currently requests broad HTTP and HTTPS host access so
it can connect to arbitrary self-hosted instances. Optional per-instance host permissions would be a
worthwhile improvement before broad store publication.

## Credits and license

Bookmark Injector is MIT licensed; see [LICENSE](LICENSE).

This project builds on:

- [Fivefold/linkding-injector](https://github.com/Fivefold/linkding-injector), created by Jakob
  Essbüchl.
- Code adapted there from Sascha Ißbrücker's
  [official Linkding extension](https://github.com/sissbruecker/linkding-extension).

The Readeck service icon is © 2021 Olivier Meunier and distributed under AGPL-3.0-only. Its source
and license metadata are recorded in `icons/readeck.svg.license`.
