import { describe, expect, it } from "vitest";
import { archiveTitle, formatArchiveDate } from "./folder-view";

describe("folder archive card display", () => {
  it("uses the saved title and falls back to the original URL", () => {
    expect(archiveTitle({ title: "Saved page", originalUrl: "https://example.test" })).toBe("Saved page");
    expect(archiveTitle({ title: null, originalUrl: "https://example.test" })).toBe("https://example.test");
  });

  it("formats valid archive dates for the Seoul locale and preserves invalid values", () => {
    expect(formatArchiveDate("2026-08-28T00:00:00.000Z")).toBe("2026. 8. 28.");
    expect(formatArchiveDate("not-a-date")).toBe("not-a-date");
  });
});
