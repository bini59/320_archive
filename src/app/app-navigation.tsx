"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "사이트 등록" },
  { href: "/archives", label: "사이트 열람" },
];

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className={mobile ? "flex gap-2" : "flex flex-col gap-1 p-3"}>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={mobile
              ? `btn btn-sm ${active ? "btn-neutral" : "btn-ghost"}`
              : `rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium ${active ? "border-base-content bg-base-200 text-base-content" : "border-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content"}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
