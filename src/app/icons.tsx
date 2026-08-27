// apps 320: 2A icon set. viewBox 0 0 24 24, stroke=currentColor.
type P = { size?: number };

const base = (size = 15) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const PlusIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.2} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
export const BoxIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>
);
export const SearchIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const SettingsIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.5 1.5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);
export const UserIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
);
export const ExternalLinkIcon = ({ size = 12 }: P) => (
  <svg {...base(size)} aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4l-8.5 8.5" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
);
export const LogOutIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden="true"><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const SunIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const MoonIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2} aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
export const SystemIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2} aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
);
