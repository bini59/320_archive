"use client";

import { startTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, type AuthenticatedUser, type NavItem } from "@bini59/design";
import type { Folder } from "@/lib/archive/types";
import { logoutAction } from "./actions";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette } from "./command-palette";
import { BoxIcon, PlusIcon, SearchIcon, SettingsIcon } from "./icons";
import { activeNavId } from "./nav";
import { ThemeToggle } from "./theme-toggle";

export function ArchiveShell({ user, folders, accountCenterUrl, children }: { user: AuthenticatedUser; folders: Folder[]; accountCenterUrl: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const nav: NavItem[] = [
    { id: "register", label: "사이트 등록", href: "/", icon: <PlusIcon size={15} /> },
    { id: "archives", label: "공개 탐색", href: "/archives", icon: <SearchIcon size={15} /> },
    { id: "library", label: "내 보관함", href: "/library", icon: <BoxIcon size={15} />, children: folders.map((folder) => ({ id: `folder:${folder.id}`, label: folder.name, href: `/library/${folder.id}` })) },
    { id: "settings", label: "사이트 환경설정", href: "/settings", icon: <SettingsIcon size={15} /> },
  ];

  return (
    <AppShell
      accountCenterUrl={accountCenterUrl}
      activeId={activeNavId(pathname)}
      brand={{ mark: <img alt="" className="size-full object-cover" src="https://static.bini59.dev/logo/logo-128.png" />, name: "Archive", host: "archive.bini59.dev", href: "/" }}
      crumb={<Breadcrumb />}
      nav={nav}
      onLogout={() => startTransition(() => logoutAction())}
      profilePlacement="sidebar"
      renderLink={(item, inner) => <Link href={item.href ?? "/"}>{inner}</Link>}
      sidebarFoot={<ThemeToggle />}
      topbarActions={<CommandPalette />}
      user={user}
    >
      {children}
    </AppShell>
  );
}
