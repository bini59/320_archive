"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useThemePreference } from "./use-preferences";
import type { ThemePreference } from "@/lib/preferences";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: ReactNode }> = [
  { value: "system", label: "시스템", icon: "▣" },
  { value: "dark", label: "다크", icon: "☾" },
  { value: "light", label: "화이트", icon: "☼" },
];

export function ThemeToggle() {
  const { preference, ready, setPreference } = useThemePreference();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      const target = event.target as HTMLElement;
      if (!target.closest("[data-theme-menu]")) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const active = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[0];
  return (
    <div className="relative" data-theme-menu>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-ghost btn-sm w-full justify-between font-normal"
        disabled={!ready}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2"><span aria-hidden="true">{active.icon}</span> 테마</span>
        <span className="text-xs text-base-content/60">{active.label}</span>
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-box border border-base-300 bg-base-100 p-1 shadow-lg" role="menu">
          {OPTIONS.map((option) => (
            <button
              aria-checked={preference === option.value}
              className="btn btn-ghost btn-sm w-full justify-start gap-2 font-normal"
              key={option.value}
              onClick={() => { setPreference(option.value); setOpen(false); }}
              role="menuitemradio"
              type="button"
            >
              <span aria-hidden="true">{option.icon}</span><span>{option.label}</span>
              {preference === option.value ? <span className="ml-auto" aria-label="선택됨">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
