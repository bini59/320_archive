import type { ReactNode } from "react";
import Link from "next/link";

export function HomeView({ children }: { children: ReactNode }) {
  return <main className="page"><div className="page-head"><div><h1>사이트 등록</h1></div><Link className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</Link></div><div className="page-content page-content-registration">{children}</div></main>;
}
