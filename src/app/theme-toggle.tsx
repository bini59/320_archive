"use client";

import { useThemePreference } from "./use-preferences";
import { MoonIcon, SunIcon, SystemIcon } from "./icons";
import type { ThemePreference } from "@/lib/preferences";

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: React.ComponentType<{ size?: number }> }> = [
  { value: "light", label: "라이트", Icon: SunIcon },
  { value: "dark", label: "다크", Icon: MoonIcon },
  { value: "system", label: "시스템", Icon: SystemIcon },
];

export function ThemeToggle() {
  const { preference, ready, setPreference } = useThemePreference();
  return (
    <div aria-label="테마" className="seg theme-seg" role="radiogroup">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          aria-checked={preference === value}
          aria-label={`${label} 테마`}
          className={preference === value ? "active" : ""}
          disabled={!ready}
          key={value}
          onClick={() => setPreference(value)}
          role="radio"
          title={label}
          type="button"
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
