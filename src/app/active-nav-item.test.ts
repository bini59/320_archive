import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./active-nav-item";

describe("isNavItemActive", () => {
  it("matches the registration root without activating it for child paths", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/archives/123", "/")).toBe(false);
  });

  it("matches nested routes for section navigation", () => {
    expect(isNavItemActive("/archives/123", "/archives")).toBe(true);
    expect(isNavItemActive("/library/folder", "/library")).toBe(true);
  });

  it("supports exact matches for the library primary item", () => {
    expect(isNavItemActive("/library/folder", "/library", true)).toBe(false);
    expect(isNavItemActive("/library", "/library", true)).toBe(true);
  });
});
