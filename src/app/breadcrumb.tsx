"use client";

import { usePathname } from "next/navigation";

function label(pathname: string): string {
  if (pathname === "/") return "사이트 등록";
  if (pathname === "/settings") return "사이트 환경설정";
  if (pathname === "/archives") return "공개 아카이브";
  if (pathname.startsWith("/archives/")) return "스냅숏";
  return "아카이브";
}

export function Breadcrumb() {
  const pathname = usePathname();
  const detail = pathname.startsWith("/archives/");

  return (
    <nav aria-label="현재 위치" className="crumb mono">
      <a href="/">archive</a>
      {detail ? (
        <>
          <span aria-hidden="true">/</span>
          <a href="/archives">공개 아카이브</a>
        </>
      ) : null}
      <span aria-hidden="true">/</span>
      <strong aria-current="page">{label(pathname)}</strong>
    </nav>
  );
}
