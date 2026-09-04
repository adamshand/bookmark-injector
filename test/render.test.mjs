import assert from "node:assert/strict";
import test from "node:test";

import { buildResultsPanelHtml } from "../src/render.js";

test("the injected panel interleaves providers, escapes data, and links service icons to saved copies", () => {
  const html = buildResultsPanelHtml({
    searchEngine: "google",
    themeClass: "dark",
    openLinkType: "newTab",
    showLogo: false,
    logoUrl: "chrome-extension://extension/icons/logo_32.png",
    optionsUrl: "chrome-extension://extension/icons/cog.svg",
    sourceIcons: {
      linkding: "chrome-extension://extension/icons/ld_32.png",
      readeck: "chrome-extension://extension/icons/readeck.svg",
    },
    providers: [
      {
        source: "linkding",
        total: 42,
        fullSearchUrl: "https://links.example/bookmarks?q=rust",
        results: [
          {
            url: "javascript:alert(1)",
            savedUrl: "https://archive.example/linkding-copy",
            title: "<img src=x onerror=alert(1)>",
            description: "safe & useful",
            tags: ["research"],
            note: "",
            annotations: [],
          },
          {
            url: "https://example.com/linkding-second",
            title: "Linkding second",
            description: "Second Linkding result",
            tags: [],
            note: "",
            annotations: [],
          },
        ],
      },
      {
        source: "readeck",
        total: 37,
        fullSearchUrl: "https://read.example/bookmarks?search=rust+%26+types",
        results: [
          {
            url: "https://example.com/article?x=1&y=2",
            savedUrl: "https://read.example/bookmarks/abcdefghijklmnopqr",
            title: "Rust & types",
            description: "Article description",
            tags: ["rust"],
            note: "Bookmark note",
            annotations: [{ text: "Selected text", note: "My <note>", color: "yellow" }],
          },
          {
            url: "https://example.com/readeck-second",
            savedUrl: "https://read.example/bookmarks/secondbookmarkid123",
            title: "Readeck second",
            description: "Second Readeck result",
            tags: [],
            note: "",
            annotations: [],
          },
        ],
      },
    ],
  });

  const positions = [
    html.indexOf("&lt;img src=x"),
    html.indexOf("Rust &amp; types"),
    html.indexOf("Linkding second"),
    html.indexOf("Readeck second"),
  ];
  assert.deepEqual(positions, positions.toSorted((left, right) => left - right));
  assert.match(html, /class="source-copy linkding" href="https:\/\/archive\.example\/linkding-copy"/);
  assert.match(html, /class="source-copy readeck" href="https:\/\/read\.example\/bookmarks\/abcdefghijklmnopqr"/);
  assert.match(html, /icons\/ld_32\.png/);
  assert.match(html, /icons\/readeck\.svg/);
  assert.doesNotMatch(html, /Open saved copy/);
  assert.match(html, /View all 42 results in Linkding/);
  assert.match(html, /View all 37 results in Readeck/);
  assert.match(
    html,
    /<ul class="bookmark-list dark">[\s\S]*?<div class="result-details">[\s\S]*?<div class="description">/,
    "metadata should share one indented wrapper beneath the title text",
  );
  assert.match(html, /https:\/\/read\.example\/bookmarks\?search=rust\+%26\+types/);
  assert.match(html, /My &lt;note&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /private-token/);
});
