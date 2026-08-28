"use client";

import { usePathname } from "next/navigation";

export function ActiveNavItem({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <a aria-current={active ? "page" : undefined} className={`nav-item${active ? " active" : ""}`} href={href}>{children}</a>;
}
