import { describe, expect, it } from "vitest";

import {
  buildRenderedAssets,
  isRenderedResourceMime,
  normalizeResourceUrl,
  rewriteCssReferences,
} from "./rendered";

const ARCHIVE_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("rendered resource policy", () => {
  it("normalizes only credential-free HTTP(S) resource URLs", () => {
    expect(normalizeResourceUrl("../fonts/site.woff2#glyph", "https://example.com/css/main.css")).toBe(
      "https://example.com/fonts/site.woff2",
    );
    expect(normalizeResourceUrl("data:text/css,bad", "https://example.com/css/main.css")).toBeNull();
    expect(normalizeResourceUrl("https://user:pass@example.com/style.css", "https://example.com")).toBeNull();
  });

  it("accepts only the rendered resource MIME allowlist", () => {
    expect(isRenderedResourceMime("text/css")).toBe(true);
    expect(isRenderedResourceMime("font/woff2")).toBe(true);
    expect(isRenderedResourceMime("application/javascript")).toBe(false);
    expect(isRenderedResourceMime("image/svg+xml")).toBe(false);
  });

  it("rewrites CSS imports and url references to local assets and removes fallbacks", () => {
    const themePath = `/archives/${ARCHIVE_ID}/assets/${"a".repeat(64)}.css`;
    const fontPath = `/archives/${ARCHIVE_ID}/assets/${"b".repeat(64)}.woff2`;
    const heroPath = `/archives/${ARCHIVE_ID}/assets/${"c".repeat(64)}.png`;
    const paths = new Map([
      ["https://cdn.example/theme.css", themePath],
      ["https://cdn.example/font.woff2", fontPath],
      ["https://cdn.example/hero.png", heroPath],
    ]);

    const css = `@import url("https://cdn.example/theme.css");
      .hero { background-image: url(https://cdn.example/hero.png), url(https://remote.invalid/fallback.png); }
      @font-face { font-family: Fixture; src: url("https://cdn.example/font.woff2") format("woff2"), url("https://remote.invalid/fallback.woff2"); }`;

    const result = rewriteCssReferences(css, "https://example.com/page", (url) => paths.get(url) ?? null);

    expect(result).toContain(themePath);
    expect(result).toContain(heroPath);
    expect(result).toContain(fontPath);
    expect(result).not.toContain("cdn.example");
    expect(result).not.toContain("remote.invalid");
  });

  it("builds digest-keyed CSS and inline-style assets", () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const font = Buffer.from("wOF2\0\0\0\0fixture-font", "binary");
    const result = buildRenderedAssets({
      archiveId: ARCHIVE_ID,
      resources: [
        {
          requestUrl: "https://cdn.example/main.css",
          finalUrl: "https://cdn.example/main.css",
          mimeType: "text/css",
          bytes: Buffer.from(".hero{background:url(https://cdn.example/hero.png)} @font-face{src:url(https://cdn.example/font.woff2)}"),
        },
        {
          requestUrl: "https://cdn.example/hero.png",
          finalUrl: "https://cdn.example/hero.png",
          mimeType: "image/png",
          bytes: image,
        },
        {
          requestUrl: "https://cdn.example/font.woff2",
          finalUrl: "https://cdn.example/font.woff2",
          mimeType: "font/woff2",
          bytes: font,
        },
      ],
      inlineStyles: [{ css: ".hydrated{color:red}", baseUrl: "https://example.com/page" }],
      styleAttributes: [{ css: "background-image:url(https://cdn.example/hero.png)", baseUrl: "https://example.com/page" }],
    });

    const css = result.assets.find((asset) => asset.originalUrl === "https://cdn.example/main.css");
    expect(css).toBeDefined();
    expect(new TextDecoder().decode(css!.bytes)).toContain(`/archives/${ARCHIVE_ID}/assets/`);
    expect(new TextDecoder().decode(css!.bytes)).toMatch(/\.woff2/);
    expect(result.resourcePaths.get("https://cdn.example/hero.png")).toMatch(/\.png$/);
    expect(result.resourcePaths.get("https://cdn.example/font.woff2")).toMatch(/\.woff2$/);
    expect(result.inlineStylePaths).toHaveLength(1);
    expect(result.styleAttributePath).toMatch(/\.css$/);
  });
});
