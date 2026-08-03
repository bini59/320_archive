import { describe, expect, it } from "vitest";
import { normalizeTagSlug, parseTags, TagValidationError } from "./tags";

describe("parseTags", () => {
  it("normalizes whitespace, Unicode width, casing and duplicates", () => {
    expect(parseTags(" News, news, 한국  소식, Ｔｅｃｈ ")).toEqual([
      { name: "News", slug: "news" }, { name: "한국 소식", slug: "한국-소식" }, { name: "Tech", slug: "tech" },
    ]);
  });
  it("accepts empty input and ignores empty comma fields", () => {
    expect(parseTags(" ,  ,")).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
  it("rejects punctuation and bounded resource violations", () => {
    expect(() => parseTags("bad/tag")).toThrow(TagValidationError);
    expect(() => parseTags("x".repeat(33))).toThrow(TagValidationError);
    expect(() => parseTags(Array.from({ length: 11 }, (_, i) => `tag${i}`).join(","))).toThrow(TagValidationError);
  });
});

describe("normalizeTagSlug", () => {
  it("normalizes valid slugs and rejects malformed or oversized query input", () => {
    expect(normalizeTagSlug("ＴＥＣＨ-뉴스")).toBe("tech-뉴스");
    expect(normalizeTagSlug("bad slug")).toBeNull();
    expect(normalizeTagSlug("x".repeat(33))).toBeNull();
    expect(normalizeTagSlug("news' OR 1=1 --")).toBeNull();
  });
});
