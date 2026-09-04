# Security model

## Search authorization and delivery

1. Static content-script registration targets explicit public search-engine hosts.
   Dynamic registration targets approved SearX hostnames only. Browser match patterns
   do not consistently express ports, so injection itself is not the trust boundary.
2. A top-level content script opens a controller port. The background validates its
   extension sender ID, frame ID, originating host, current tab search identity (origin,
   route, and query), supported search route, and exact approved origin. Tracking
   parameters and fragments do not invalidate an otherwise unchanged search. Broad API host permissions do not authorize a page.
3. After locating a sidebar and extracting a nonblank query, the controller receives
   a random channel and inserts `results/index.html` from the installed extension.
4. That document connects through its own extension runtime port. The background
   checks its extension URL, subframe sender, matching tab, current search URL, and
   unconsumed channel. Standalone embedding, another tab, and attachment replay cannot
   initiate searches. Pending attachments expire after 30 seconds.
5. Providers are searched only after attachment. Results and provider warnings go
   directly to the iframe, never through the controller or `window.postMessage`.
   Configuration messages include presentation settings, not credentials.
6. Controller disconnection closes its result connection. Settings changes revoke
   active controller sessions; iframe storage listeners also clear completed results
   after an idle background worker has been suspended.

The parent page receives only iframe sizing and color-scheme metadata. Its scripts cannot read the
cross-origin iframe DOM, private titles, URLs, tags, descriptions, notes, or annotations.
Same-tab result links use `_top`, not `_self`, so they navigate the tab rather than
replacing the iframe. Links suppress referrers and new-tab opener access.

## Provider credentials and networking

Credentials live in extension-local storage. Chrome additionally limits storage access
to trusted extension contexts. Searches use the background worker; explicit connection
tests use the options page. Both providers require HTTPS without URL-embedded credentials.
API redirects are rejected to avoid downgrade and credential-forwarding ambiguity.
Use the final instance base URL, including any path prefix.

Requests omit ambient cookies, bypass HTTP caches, and use a ten-second deadline that
covers both fetch and JSON body consumption. Provider construction and searches are
isolated inside per-provider tasks with a twelve-second orchestration deadline.
Annotation enrichment updates already-visible results and has a fifteen-second display
deadline. Individual outstanding annotation reads remain subject to request deadlines;
shared reads are not canceled just because one consumer stops displaying results.

Result text is escaped and link protocols are checked before rendering. Provider failures
are converted to fixed user-facing warnings rather than forwarding arbitrary exception
strings, which could contain credentials.

## Limitations

- Approved search sites can initiate searches and observe iframe presence, dimensions,
  and timing. Approval is not permission to read result content, but should still be
  granted only to trusted instances.
- A host page can remove, hide, or overlay an iframe. Cross-origin isolation protects
  content confidentiality, not availability or protection from every form of clickjacking.
- The extension retains broad HTTP/HTTPS API host permissions for self-hosted services.
  Optional per-instance permissions are a future hardening opportunity.
- Bookmark servers are trusted to receive search queries and hold their own data.
- Search-engine layouts may change. Selector adapters fail quietly after bounded waits;
  they never relax authorization to recover placement.

## Verification

`npm test` covers origin spoofing, iframe tab binding and replay, navigation/revocation,
HTTPS enforcement, redirect policy, body timeouts, progressive delivery, constructor
failures, disabled configuration saves, dynamic registration, duplicate initialization,
blank queries, and missing sidebars. `npm run build` produces the Chrome extension;
`node scripts/prepare-firefox.mjs` generates the Firefox staging tree for `web-ext lint`.

Browser smoke checks should additionally cover real cross-origin DOM isolation, iframe
sizing, same-tab navigation, back/forward restoration, client-side query changes, delayed
or replaced sidebars, and options saving with both providers disabled. Provider unit tests
use fixtures; live service compatibility and search-engine layout checks remain separate.
