import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { setArchiveVisibilityAction } from "@/app/actions";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  await connection();
  const identity = await requireAuthenticatedSession();
  const service = getArchiveService();
  const folder = service.listFolders(identity.userId).find((item) => item.id === folderId);
  if (!folder) notFound();
  const archives = service.listOwned(identity.userId, folderId);
  return <main className="page">
    <div className="page-head"><div><p className="section-label">내 보관함</p><h1>{folder.name}</h1><p>{archives.length}개의 아카이브</p></div><a className="btn btn-primary" href={`/?folderId=${encodeURIComponent(folder.id)}`}>새 사이트 등록</a></div>
    <div className="card"><div className="card-head">보관 목록</div>{archives.length ? <div className="table-wrap"><table className="data"><thead><tr><th>사이트</th><th>저장일</th><th>공개 설정</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{archives.map((archive) => <tr key={archive.id}><td><div className="cell-main"><div><strong><a href={`/archives/${archive.id}`}>{archive.snapshot?.title ?? "제목 없는 사이트"}</a></strong><span className="mono">{archive.originalUrl}</span></div></div></td><td className="mono nums dim">{formatDate(archive.createdAt)}</td><td><form action={setArchiveVisibilityAction} className="inline-form"><input name="id" type="hidden" value={archive.id} /><select aria-label={`${archive.snapshot?.title ?? archive.originalUrl} 공개 설정`} className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select><button className="btn btn-sm" type="submit">저장</button></form></td><td><a className="btn btn-ghost btn-sm" href={`/archives/${archive.id}`}>열기</a></td></tr>)}</tbody></table></div> : <div className="card-body"><p className="muted">이 폴더에 저장된 아카이브가 없습니다.</p></div>}</div>
  </main>;
}
