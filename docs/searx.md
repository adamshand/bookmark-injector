**SearX/SearXNG support**

This extension includes experimental support for self-hosted SearX/SearXNG instances. To work, your instance must follow either of these URL patterns: `*://*/search?*`, `*://*/search`

Examples that work:
- `https://search.mywebsite.com/search`
- `https://search.mywebsite.com/search?q=searchTerm`
- `http://mysearch.local/search`

Examples that *don't* work:
- `https://search.mywebsite.com/`
- `http://mywebsite.com/searx/`
- `http://mywebsite.com/searx/search`

Also, nothing might be injected if you don't use the default "simple" theme.

If the Bookmark Injector panel appears on other supported search engines but not on your SearX instance, check the [known issues](https://github.com/adamshand/bookmark-injector/issues) or [report it](https://github.com/adamshand/bookmark-injector/issues/new).