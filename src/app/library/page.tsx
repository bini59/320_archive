import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { ArchiveForm } from "@/app/archive-form";
import { createFolderAction, renameFolderAction, deleteFolderAction, setArchiveVisibilityAction } from "@/app/actions";

export default async function LibraryPage() {
  const identity = await requireAuthenticatedSession();
  const service = getArchiveService();
  const folders = service.listFolders(identity.userId);
  const archives = service.listOwned(identity.userId);
  return <main className="page"><div className="page-head"><div><h1>내 보관함</h1><p>{archives.length}개의 개인 아카이브</p></div><a className="btn btn-primary" href="/">새 URL 보관하기</a></div><div className="card archive-form"><div className="card-head">사이트 등록</div><div className="card-body"><ArchiveForm returnTo="/library" /></div></div><div className="card"><div className="card-head">폴더</div><div className="card-body"><form action={createFolderAction} className="form-row"><input className="input" name="name" placeholder="새 폴더 이름" maxLength={100} required /><button className="btn" type="submit">폴더 만들기</button></form><nav aria-label="내 폴더" className="chips mt-4">{folders.map((folder) => <a className="chip" href={`/library/${folder.id}`} key={folder.id}>{folder.name}</a>)}</nav></div></div><div className="card card-body">{archives.length ? archives.map((archive) => <div className="flex items-center justify-between gap-3 border-b py-3" key={archive.id}><a href={`/archives/${archive.id}`}>{archive.snapshot?.title ?? archive.originalUrl}</a><form action={setArchiveVisibilityAction}><input name="id" type="hidden" value={archive.id} /><select aria-label="공개 설정" className="input" name="visibility" defaultValue={archive.visibility}><option value="private">비공개</option><option value="public">공개</option></select><button className="btn btn-sm" type="submit">저장</button></form></div>) : <p className="muted">아직 저장된 아카이브가 없습니다.</p>}</div></main>;
}
