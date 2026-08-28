"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function isNavItemActive(pathname: string, href: string, exact = false) {
  return href === "/" ? pathname === "/" : exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function ActiveNavItem({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, href, exact);
  return <Link aria-current={active ? "page" : undefined} className={`nav-item${active ? " active" : ""}`} href={href}>{children}</Link>;
}
