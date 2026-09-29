export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const VIEW_PREFERENCES = ["rendered", "readable", "original"] as const;
export type ViewPreference = (typeof VIEW_PREFERENCES)[number];

export const THEME_STORAGE_KEY = "archive.theme";
export const VIEW_STORAGE_KEY = "archive.default-view";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const DEFAULT_VIEW_PREFERENCE: ViewPreference = "rendered";

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : DEFAULT_THEME_PREFERENCE;
}

export function parseViewPreference(value: string | null | undefined): ViewPreference {
  return VIEW_PREFERENCES.includes(value as ViewPreference) ? (value as ViewPreference) : DEFAULT_VIEW_PREFERENCE;
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}


// Design tokens default to dark, so system mode must still write the resolved theme.
export function applyThemePreference(preference: ThemePreference, root: Element, systemPrefersDark: boolean): void {
  root.setAttribute("data-theme", resolveTheme(preference, systemPrefersDark));
}

export function readStoredPreference<T>(key: string, parse: (value: string | null) => T, fallback: T): T {
  try {
    return parse(window.localStorage.getItem(key));
  } catch {
    return fallback;
  }
}

export function writeStoredPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or a full quota must not break the interaction.
  }
}

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
