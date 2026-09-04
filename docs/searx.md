# SearX / SearXNG support

1. Open the extension options page.
2. Add your instance to **Approved instance URLs**, one HTTPS URL per line.
3. Save, then reload the search page.

Approval covers the full **origin** (scheme, hostname, and port). Entering
`https://search.example.org/searx/` approves `https://search.example.org`, not only
that path. Only approve instances you trust to initiate searches of your private library.
HTTP instances are not supported.

Approved instances may use `/search`, a path prefix such as `/searx/search`, or a
root/prefix URL with a `q` query parameter. POST searches can read the query from
`input#q` or `input[name=q]`. Blank queries are skipped.

The default Simple theme is supported through `#sidebar` and `aside.sidebar`.
The extension waits up to ten seconds for a sidebar. If your custom theme has
neither container, no panel is inserted. This failure does not broaden access
or start an unfiltered bookmark search.

Removing an instance revokes future background searches and updates dynamic
content-script registration. Reload existing tabs after changing settings.

Private results load inside an extension-origin iframe, not directly into your
instance's DOM. See [the security model](security.md).
