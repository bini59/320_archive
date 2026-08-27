import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { AppNavigation } from "./app-navigation";
import { Breadcrumb } from "./breadcrumb";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { SettingsIcon } from "./icons";

async function currentIdentity() {
  try {
    const sid = (await cookies()).get("sid")?.value;
    const identity = await verifySession(sid);
    return identity?.membership?.status === "active" ? identity : null;
  } catch {
    return null;
  }
}

function initials(name: string | null, email: string | null) {
  return (name || email || "?").slice(0, 1).toUpperCase();
}

function safeAvatarUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await currentIdentity();

  if (!identity) return children;

  const displayName = identity.name || identity.email || "사용자";
  const avatarUrl = safeAvatarUrl(identity.avatarUrl);
  const fallback = initials(identity.name, identity.email);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img alt="" src="https://static.bini59.dev/logo/logo-128.png" />
          <span>
            <span className="brand-name">Archive</span>
            <span className="brand-host mono">archive.bini59.dev</span>
          </span>
        </a>
        <AppNavigation />
        <div className="sidebar-foot">
          <ThemeToggle />
          <a className="nav-item" href="/client">
            <span className="avatar">
              {avatarUrl ? <img alt={`${displayName} 프로필 사진`} src={avatarUrl} /> : fallback}
            </span>
            <span>{displayName}</span>
          </a>
          <a className="nav-item" href="/settings">
            <SettingsIcon />
            <span>사이트 환경설정</span>
          </a>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <Breadcrumb />
          <span className="topbar-spacer" />
          <CommandPalette />
          <a aria-label="계정 설정" className="avatar" href="/client">
            {avatarUrl ? <img alt="" src={avatarUrl} /> : fallback}
          </a>
        </header>
        <div className="mobile-nav">
          <AppNavigation mobile />
        </div>
        {children}
      </div>
    </div>
  );
}
