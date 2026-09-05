# Regression testing

The goal is protection of public behavior and trust boundaries, not a coverage percentage.

## Running tests

Use Node.js 24 LTS or newer and npm. Browser tests also require `openssl` on PATH
(available by default on macOS and the Ubuntu CI runner):

```sh
npm ci
npm test                       # Fast Node tests + captured provider responses
npx playwright install chromium # Once per Playwright/browser update
npm run test:browser            # Production build, then real-extension browser tests
npm run test:all                # Both suites
```

On Linux CI, install browser system dependencies with
`npx playwright install --with-deps chromium`. Normal test execution uses local
fixtures only; npm/browser installation is the network-dependent setup step.

Useful focused runs:

```sh
node --test test/authorization-races.test.mjs
npm run test:browser -- --grep 'Google dark'
HEADED=1 npm run test:browser
```

`HEADED=1` is POSIX shell syntax; set that environment variable normally in PowerShell.
Browser failures retain Playwright traces and screenshots under `test-results/browser/`:

```sh
npx playwright show-trace test-results/browser/<failed-case>/trace.zip
```

Each browser case uses a disposable profile and a local HTTPS server. No personal
Chrome profile, real provider credentials, or live search engine is used. The
TLS certificate is generated outside the repository in an OS temporary directory;
the files are removed immediately after being read into memory. No PEM files ship
inside the unpacked extension. Certificate exceptions apply only to that disposable
browser. Profiles and servers are cleaned up after each case.

## What the suites protect

### Real extension/browser behavior

`browser-tests/` loads the **built, unchanged manifest and extension assets**, not
source modules inserted into a mock page. It uses Playwright's bundled Chromium;
regular branded Chrome no longer supports the necessary side-loading flags.

- Results are visible inside the extension frame but inaccessible to host scripts.
  Page-visible messages must not contain private content or tokens.
- Another origin embedding the frame cannot initiate additional provider searches.
- Tracking-only changes preserve the iframe and request count; a new query cannot
  display late results from the previous query.
- Both Google light and dark panels fill narrow/wide frames, agree on color scheme
  and rounded corners, and resize when annotations arrive without clipping.
- Same-tab links navigate the tab, and back navigation restores working searches.
- Options retain a saved disabled state; offline providers do not prevent saving;
  storage errors never produce a false success or persist the rejected change.

Provider requests actually cross HTTPS to the loopback server, including background
worker requests. Server response gates make delayed searches and annotations explicit.
Tests wait for observable UI/network states rather than fixed sleeps. The custom
checkboxes/radios are operated with keyboard input, not forced DOM changes.
Only the storage-failure case substitutes a browser API to inject an otherwise
hard-to-produce error. Assertions then go through the real options UI.

### Authorization interruptions

`test/authorization-races.test.mjs` exercises runtime-port behavior with the actual
router, orchestration, and Linkding client. Only browser APIs, remote HTTP responses,
and time are simulated. Controlled promises pause tab lookup; fake time advances
attachment expiry without waiting 30 seconds.

Revocation, controller disconnection, simultaneous channel consumption, and expired
attachments must start no unauthorized requests or deliver private results.

### Provider compatibility

`test/provider-contracts.test.mjs` replays captured responses from Linkding 1.46.2
and Readeck 0.23.2. It verifies real null/empty metadata, notes/highlights, pagination
totals, prefixed client URLs, and authentication failures. Fixture provenance and an
optional Docker regeneration command are in
[`test/fixtures/providers/README.md`](../test/fixtures/providers/README.md).

The browser scenario server intentionally uses small synthetic responses; it is not
a substitute for those independent upstream captures.

## Checks before a release

CI runs both suites and Firefox packaging lint. Browser automation currently covers
**Chromium only**, not Firefox or live-engine compatibility.

1. Build and lint the Firefox staging tree:
   ```sh
   npm run build
   node scripts/prepare-firefox.mjs
   npx web-ext lint --source-dir dist/firefox
   ```
2. In a disposable Firefox profile, load `dist/firefox/manifest.json` through
   `about:debugging` (or `web-ext run --source-dir dist/firefox`). Confirm results,
   iframe privacy, light/dark layout, same/new-tab links, back/forward, and settings
   changes. Extension-origin messaging and background lifecycle differ from Chrome.
3. In Chrome and Firefox, spot-check Google, DuckDuckGo, Brave, Kagi, Qwant and one
   approved SearX/SearXNG instance. Check placement, initial loading, repeated queries,
   empty queries and dark mode. Use read-only test credentials where available.
4. Reload the extension with a search tab open, then reload the tab. Confirm no
   repeated context-invalidated errors. Check an unavailable provider does not hide
   the healthy provider's results.

Do not put live-engine searches or full-page HTML snapshots into the per-commit suite:
layout experiments, login requirements and bot challenges would create noisy failures.
Keep production selector changes small and grounded in the release spot-checks.
