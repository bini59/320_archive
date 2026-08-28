import { setArchiveVisibilityAction } from "@/app/actions";
import type { Archive, Folder } from "@/lib/archive/types";

export function formatArchiveDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }); }

export function archiveTitle({ title, originalUrl }: Pick<Archive, "originalUrl"> & { title?: string | null }): string {
  return title ?? originalUrl;
}

export function FolderView({ children }: { children: React.ReactNode }) {
  return <main className="page">{children}</main>;
}

export function FolderDataView({ folder, archives }: { folder: Folder; archives: Archive[] }) {
  return <><div className="page-head"><div><p className="section-label">내 보관함</p><h1>{folder.name}</h1></div><a className="btn btn-primary" href={`/?folderId=${encodeURIComponent(folder.id)}`}>새 사이트 등록</a></div><div><p className="mb-3">{archives.length}개의 아카이브</p><div className="card"><div className="card-head">보관 목록</div>{archives.length ? <>
    <div className="table-wrap folder-archive-table"><table className="data"><thead><tr><th>사이트</th><th>저장일</th><th>공개 설정</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{archives.map((archive) => <tr key={archive.id}><td><div className="cell-main"><div><strong><a href={`/archives/${archive.id}`}>{archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })}</a></strong><span className="mono">{archive.originalUrl}</span></div></div></td><td className="mono nums dim">{formatArchiveDate(archive.createdAt)}</td><td><form action={setArchiveVisibilityAction} className="inline-form"><input name="id" type="hidden" value={archive.id} /><select aria-label={`${archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })} 공개 설정`} className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select><button className="btn btn-sm" type="submit">저장</button></form></td><td><a className="btn btn-ghost btn-sm" href={`/archives/${archive.id}`}>열기</a></td></tr>)}</tbody></table></div>
    <ul aria-label="모바일 보관 목록" className="folder-archive-cards">{archives.map((archive) => <li className="folder-archive-card" key={archive.id}><div className="folder-archive-card__header"><strong className="folder-archive-card__title">{archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })}</strong><a className="btn btn-ghost btn-sm" href={`/archives/${archive.id}`}>열기</a></div><p className="folder-archive-card__url mono">{archive.originalUrl}</p><dl className="folder-archive-card__meta"><div><dt>저장일</dt><dd className="mono nums">{formatArchiveDate(archive.createdAt)}</dd></div></dl><form action={setArchiveVisibilityAction} className="folder-archive-card__visibility"><input name="id" type="hidden" value={archive.id} /><label><span>공개 설정</span><select aria-label={`${archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })} 공개 설정`} className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select></label><button className="btn btn-sm" type="submit">저장</button></form></li>)}</ul>
  </> : <div className="card-body"><p className="muted">이 폴더에 저장된 아카이브가 없습니다.</p></div>}</div></div></>;
}
