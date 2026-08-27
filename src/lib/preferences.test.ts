import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_VIEW_PREFERENCE,
  THEME_BOOT_SCRIPT,
  applyThemePreference,
  parseThemePreference,
  parseViewPreference,
  resolveTheme,
} from "./preferences";

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  } as unknown as Element & { attributes: Map<string, string> };
}

describe("preferences", () => {
  it("falls back to defaults for unknown stored values", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("<script>")).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseViewPreference("readable")).toBe("readable");
    expect(parseViewPreference("nope")).toBe(DEFAULT_VIEW_PREFERENCE);
  });

  it("resolves system preference against the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("clears data-theme for system so daisyUI prefers-color-scheme applies", () => {
    const root = fakeRoot();
    applyThemePreference("dark", root);
    expect(root.attributes.get("data-theme")).toBe("dark");
    applyThemePreference("system", root);
    expect(root.attributes.has("data-theme")).toBe(false);
  });

  it("keeps the boot script self-contained and guarded", () => {
    expect(THEME_BOOT_SCRIPT).toContain("localStorage.getItem");
    expect(THEME_BOOT_SCRIPT).toContain("try");
    expect(THEME_BOOT_SCRIPT).toContain("catch");
    expect(THEME_BOOT_SCRIPT).not.toContain("</script");
  });
});
