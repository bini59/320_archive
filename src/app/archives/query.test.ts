import { describe, expect, it } from "vitest";
import { archiveListHref, parseArchiveSearchParams } from "./query";

describe("archive library query", () => {
  it("bounds and normalizes untrusted URL parameters", () => {
    expect(parseArchiveSearchParams({ q: `  ${"가".repeat(250)}  `, tag: " News ", page: "9999" })).toEqual({
      q: "가".repeat(200), tag: "news", page: 1000,
    });
    expect(parseArchiveSearchParams({ page: "not-a-number" })).toEqual({ page: 1 });
  });

  it("builds stable links without empty parameters", () => {
    expect(archiveListHref({ q: "검색어", tag: "뉴스", page: 2 })).toBe("/archives?q=%EA%B2%80%EC%83%89%EC%96%B4&tag=%EB%89%B4%EC%8A%A4&page=2");
    expect(archiveListHref({ q: "", page: 1 })).toBe("/archives");
  });
});
