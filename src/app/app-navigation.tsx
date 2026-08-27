"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, PlusIcon } from "./icons";

const items = [
  { href: "/", label: "사이트 등록", Icon: PlusIcon },
  { href: "/archives", label: "사이트 열람", Icon: BoxIcon },
];

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className={mobile ? "nav nav-mobile" : "nav"}>
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`nav-item${active ? " active" : ""}`}
            href={href}
            key={href}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
