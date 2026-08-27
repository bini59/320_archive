import { connection } from "next/server";
import { getArchiveService } from "@/lib/archive/service";
import type { PublicArchiveItem } from "@/lib/archive/types";
import { BoxIcon, SearchIcon } from "@/app/icons";
import { archiveListHref, parseArchiveSearchParams } from "./query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function ArchiveRow({ item }: { item: PublicArchiveItem }) {
  return (
    <tr>
      <td>
        <div className="cell-main">
          <span className="empty-mark" style={{ width: 24, height: 24, margin: 0, borderRadius: 6 }}><BoxIcon size={13} /></span>
          <div>
            <strong><a href={`/archives/${item.id}`}>{item.title ?? item.originalUrl}</a></strong>
            <span className="mono">{item.originalUrl}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="chips">
          {item.tags.map((tag) => <a className="badge" href={archiveListHref({ tag: tag.slug })} key={tag.slug}>#{tag.name}</a>)}
        </div>
      </td>
      <td className="mono dim nums"><time dateTime={item.capturedAt}>{formatDate(item.capturedAt)}</time></td>
      <td><span className="badge badge-accent">저장 완료</span></td>
    </tr>
  );
}

export default async function ArchivesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseArchiveSearchParams(await searchParams);
  await connection();
  const result = getArchiveService().listPublic(query);
  const visibleTags = Array.from(new Map(result.items.flatMap((item) => item.tags).map((tag) => [tag.slug, tag])).values());

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>공개 아카이브</h1>
          <p><span className="nums">{result.total}</span>개의 저장된 아카이브{query.tag ? ` · #${query.tag}` : ""}</p>
        </div>
        <a className="btn btn-primary" href="/">새 URL 보관하기</a>
      </div>

      <form action="/archives" className="toolbar" method="get">
        <span className="search">
          <SearchIcon />
          <label className="sr-only" htmlFor="archive-search">아카이브 검색</label>
          <input className="input" defaultValue={query.q} id="archive-search" maxLength={200} name="q" placeholder="제목, URL, 본문 검색" type="search" />
        </span>
        {query.tag ? <input name="tag" type="hidden" value={query.tag} /> : null}
        <button className="btn" type="submit">검색</button>
        {(query.q || query.tag) ? <a className="btn btn-ghost" href="/archives">필터 초기화</a> : null}
      </form>

      {visibleTags.length ? (
        <nav aria-label="현재 결과의 태그" className="chips" style={{ marginBottom: 12 }}>
          <span className="section-label" style={{ margin: 0 }}>태그</span>
          {visibleTags.map((tag) => (
            <a
              aria-current={query.tag === tag.slug ? "page" : undefined}
              className={`chip${query.tag === tag.slug ? " chip-active" : ""}`}
              href={archiveListHref({ q: query.q, tag: tag.slug })}
              key={tag.slug}
            >
              #{tag.name}
            </a>
          ))}
        </nav>
      ) : null}

      <div aria-live="polite" className="card">
        {result.items.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>제목 / URL</th><th>태그</th><th>캡처 시각</th><th>상태</th></tr>
              </thead>
              <tbody>{result.items.map((item) => <ArchiveRow item={item} key={item.id} />)}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <span className="empty-mark"><SearchIcon size={17} /></span>
            <strong>결과가 없습니다</strong>
            <p>검색어나 태그를 바꾸어 다시 찾아보세요.</p>
            <a className="btn" href="/archives">필터 초기화</a>
          </div>
        )}
      </div>

      {result.pageCount > 1 ? (
        <nav aria-label="페이지 이동" className="toolbar" style={{ justifyContent: "center", marginTop: 12, marginBottom: 0 }}>
          {result.page > 1 ? <a className="btn btn-sm" href={archiveListHref({ ...query, page: result.page - 1 })}>이전</a> : null}
          <span aria-current="page" className="badge nums" style={{ alignSelf: "center" }}>{result.page} / {result.pageCount}</span>
          {result.page < result.pageCount ? <a className="btn btn-sm" href={archiveListHref({ ...query, page: result.page + 1 })}>다음</a> : null}
        </nav>
      ) : null}
    </main>
  );
}
