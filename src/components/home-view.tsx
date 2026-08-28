import type { ReactNode } from "react";

export function HomeView({ children }: { children: ReactNode }) {
  return <main className="page"><div className="page-head"><div><h1>사이트 등록</h1></div><a className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</a></div>{children}</main>;
}
