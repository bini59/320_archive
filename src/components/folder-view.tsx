import { setArchiveVisibilityAction } from "@/app/actions";
import type { Archive, Folder } from "@/lib/archive/types";

export function formatArchiveDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }); }

export function archiveTitle({ title, originalUrl }: Pick<Archive, "originalUrl"> & { title?: string | null }): string {
  return title ?? originalUrl;
}

export function FolderView({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}

export function FolderDataView({ folder, archives }: { folder: Folder; archives: Archive[] }) {
  return <><div className="page-head"><div><p className="section-label">내 보관함</p><h1>{folder.name}</h1></div><a className="btn btn-primary" href={`/?folderId=${encodeURIComponent(folder.id)}`}>새 사이트 등록</a></div><section aria-labelledby="folder-archives-heading"><div className="section-heading"><h2 id="folder-archives-heading">보관 목록</h2><span className="muted nums">{archives.length}개</span></div>{archives.length ? <ul aria-labelledby="folder-archives-heading" className="folder-archive-cards">{archives.map((archive) => <li className="folder-archive-card" key={archive.id}><div className="folder-archive-card__header"><strong className="folder-archive-card__title">{archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })}</strong><a className="btn btn-ghost btn-sm" href={`/archives/${archive.id}`}>열기</a></div><p className="folder-archive-card__url mono" title={archive.originalUrl}>{archive.originalUrl}</p><dl className="folder-archive-card__meta"><div><dt>저장일</dt><dd className="mono nums">{formatArchiveDate(archive.createdAt)}</dd></div></dl><form action={setArchiveVisibilityAction} className="folder-archive-card__visibility"><input name="id" type="hidden" value={archive.id} /><label><span>공개 설정</span><select aria-label={`${archiveTitle({ title: archive.snapshot?.title, originalUrl: archive.originalUrl })} 공개 설정`} className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select></label><button className="btn btn-sm" type="submit">저장</button></form></li>)}</ul> : <div className="card card-body"><p className="muted">이 폴더에 저장된 아카이브가 없습니다.</p></div>}</section></>;
}
