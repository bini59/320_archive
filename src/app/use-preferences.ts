"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_VIEW_PREFERENCE,
  THEME_STORAGE_KEY,
  VIEW_STORAGE_KEY,
  applyThemePreference,
  parseThemePreference,
  parseViewPreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
  type ViewPreference,
} from "@/lib/preferences";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function useThemePreference(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  ready: boolean;
  setPreference: (next: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredPreference(THEME_STORAGE_KEY, parseThemePreference, DEFAULT_THEME_PREFERENCE));
    const media = window.matchMedia(DARK_QUERY);
    setSystemDark(media.matches);
    setReady(true);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredPreference(THEME_STORAGE_KEY, next);
    applyThemePreference(next, document.documentElement);
    setPreferenceState(next);
  }, []);

  return { preference, resolved: resolveTheme(preference, systemDark), ready, setPreference };
}

export function useViewPreference(): {
  preference: ViewPreference;
  ready: boolean;
  setPreference: (next: ViewPreference) => void;
} {
  const [preference, setPreferenceState] = useState<ViewPreference>(DEFAULT_VIEW_PREFERENCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredPreference(VIEW_STORAGE_KEY, parseViewPreference, DEFAULT_VIEW_PREFERENCE));
    setReady(true);
  }, []);

  const setPreference = useCallback((next: ViewPreference) => {
    writeStoredPreference(VIEW_STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  return { preference, ready, setPreference };
}
