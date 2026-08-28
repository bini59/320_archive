"use client";

import { usePathname } from "next/navigation";

export function ActiveNavItem({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return <a aria-current={active ? "page" : undefined} className={`nav-item${active ? " active" : ""}`} href={href}>{children}</a>;
}
