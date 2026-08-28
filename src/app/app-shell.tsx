import { cookies } from "next/headers";
import { accountCenterUrl, verifySession } from "@/lib/auth";
import { AppNavigation } from "./app-navigation";
import { Breadcrumb } from "./breadcrumb";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { ProfileMenu } from "./profile-menu";
import { SettingsIcon } from "./icons";
import { ActiveNavItem } from "./active-nav-item";
import Link from "next/link";
import { getArchiveService } from "@/lib/archive/service";

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
  const folders = getArchiveService().listFolders(identity.userId);
  const avatarUrl = safeAvatarUrl(identity.avatarUrl);
  const fallback = initials(identity.name, identity.email);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <img alt="" src="https://static.bini59.dev/logo/logo-128.png" />
          <span>
            <span className="brand-name">Archive</span>
            <span className="brand-host mono">archive.bini59.dev</span>
          </span>
        </Link>
        <AppNavigation folders={folders} />
        <div className="sidebar-foot">
          <ThemeToggle />
<ActiveNavItem href="/settings">
             <SettingsIcon />
             <span>사이트 환경설정</span>
           </ActiveNavItem>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <Breadcrumb />
          <span className="topbar-spacer" />
          <CommandPalette />
          <ProfileMenu
            accountCenterHref={accountCenterUrl()}
            avatarUrl={avatarUrl}
            displayName={displayName}
            email={identity.email}
            fallback={fallback}
          />
        </header>
        <div className="mobile-nav">
          <AppNavigation folders={folders} mobile />
        </div>
        {children}
      </div>
    </div>
  );
}
