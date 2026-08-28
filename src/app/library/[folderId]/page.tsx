import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { ArchiveForm } from "@/app/archive-form";
import { createFolderAction, deleteFolderAction, renameFolderAction, setArchiveVisibilityAction } from "@/app/actions";

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  await connection();
  const identity = await requireAuthenticatedSession();
  const service = getArchiveService();
  const folder = service.listFolders(identity.userId).find((item) => item.id === folderId);
  if (!folder) notFound();
  const archives = service.listOwned(identity.userId, folderId);
  const returnTo = `/library/${folderId}`;
  return <main className="page">
    <div className="page-head"><div><p className="section-label">내 보관함</p><h1>{folder.name}</h1><p>{archives.length}개의 아카이브</p></div><a className="btn btn-ghost" href="/library">전체 보관함</a></div>
    <div className="card"><div className="card-head">폴더 관리</div><div className="card-body"><form action={renameFolderAction} className="form-row"><input name="id" type="hidden" value={folder.id} /><input className="input" name="name" defaultValue={folder.name} maxLength={100} required /><button className="btn" type="submit">이름 변경</button></form><form action={deleteFolderAction} className="mt-3"><input name="id" type="hidden" value={folder.id} /><button className="btn btn-ghost" type="submit">폴더 삭제</button></form></div></div>
    <div className="card archive-form"><div className="card-head">이 폴더에 보관</div><div className="card-body"><ArchiveForm folderId={folder.id} returnTo={returnTo} /></div></div>
    <div className="card card-body">{archives.length ? archives.map((archive) => <div className="flex items-center justify-between gap-3 border-b py-3" key={archive.id}><a href={`/archives/${archive.id}`}>{archive.snapshot?.title ?? archive.originalUrl}</a><form action={setArchiveVisibilityAction}><input name="id" type="hidden" value={archive.id} /><select aria-label="공개 설정" className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select><button className="btn btn-sm" type="submit">저장</button></form></div>) : <p className="muted">이 폴더에 저장된 아카이브가 없습니다.</p>}</div>
  </main>;
}
