import { connection } from "next/server";
import { getArchiveService } from "@/lib/archive/service";
import type { PublicArchiveItem } from "@/lib/archive/types";
import { archiveListHref, parseArchiveSearchParams } from "./query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function ArchiveCard({ item }: { item: PublicArchiveItem }) {
  return (
    <article className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <h2 className="card-title"><a className="link link-hover" href={`/archives/${item.id}`}>{item.title ?? item.originalUrl}</a></h2>
        <p className="break-all text-sm text-base-content/60">{item.originalUrl}</p>
        {item.description ? <p className="text-base-content/80">{item.description}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {item.tags.map((tag) => <a className="badge badge-outline" href={archiveListHref({ tag: tag.slug })} key={tag.slug}>#{tag.name}</a>)}
          <time className="ml-auto text-xs text-base-content/60" dateTime={item.capturedAt}>{formatDate(item.capturedAt)}</time>
        </div>
      </div>
    </article>
  );
}

export default async function ArchivesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseArchiveSearchParams(await searchParams);
  await connection();
  const result = getArchiveService().listPublic(query);
  const visibleTags = Array.from(new Map(result.items.flatMap((item) => item.tags).map((tag) => [tag.slug, tag])).values());
  return (
    <main className="min-h-full bg-base-200 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold tracking-widest text-base-content/60">ARCHIVE</p><h1 className="mt-2 text-4xl font-bold">공개 아카이브</h1></div>
          <a className="btn btn-neutral" href="/">새 URL 보관하기</a>
        </header>
        <form action="/archives" className="card bg-base-100 shadow-sm" method="get">
          <div className="card-body gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="archive-search">아카이브 검색</label>
            <input className="input input-bordered min-w-0 flex-1" defaultValue={query.q} id="archive-search" maxLength={200} name="q" placeholder="제목, URL, 본문 검색" type="search" />
            {query.tag ? <input name="tag" type="hidden" value={query.tag} /> : null}
            <button className="btn btn-neutral" type="submit">검색</button>
            {(query.q || query.tag) ? <a className="btn btn-ghost" href="/archives">필터 초기화</a> : null}
          </div>
        </form>
        {visibleTags.length ? <nav aria-label="현재 결과의 태그" className="flex flex-wrap gap-2"><span className="text-sm font-semibold">태그:</span>{visibleTags.map((tag) => <a aria-current={query.tag === tag.slug ? "page" : undefined} className={`badge ${query.tag === tag.slug ? "badge-neutral" : "badge-outline"}`} href={archiveListHref({ q: query.q, tag: tag.slug })} key={tag.slug}>#{tag.name}</a>)}</nav> : null}
        <p aria-live="polite" className="text-sm text-base-content/70">{result.total}개의 저장된 아카이브{query.tag ? ` · #${query.tag}` : ""}</p>
        {result.items.length ? <section aria-label="검색 결과" className="grid gap-4">{result.items.map((item) => <ArchiveCard item={item} key={item.id} />)}</section> : <div className="card bg-base-100"><div className="card-body items-center text-center"><h2 className="card-title">결과가 없습니다</h2><p>검색어나 태그를 바꾸어 다시 찾아보세요.</p></div></div>}
        {result.pageCount > 1 ? <nav aria-label="페이지 이동" className="join flex justify-center">{result.page > 1 ? <a className="btn join-item" href={archiveListHref({ ...query, page: result.page - 1 })}>이전</a> : null}<span className="btn join-item pointer-events-none" aria-current="page">{result.page} / {result.pageCount}</span>{result.page < result.pageCount ? <a className="btn join-item" href={archiveListHref({ ...query, page: result.page + 1 })}>다음</a> : null}</nav> : null}
      </div>
    </main>
  );
}
