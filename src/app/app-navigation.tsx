import { connection } from "next/server";
import { getArchiveService } from "@/lib/archive/service";
import { requireAuthenticatedSession } from "@/lib/auth";

export async function FolderNavigation() {
  await connection();
  try {
    const identity = await requireAuthenticatedSession();
    const folders = getArchiveService().listFolders(identity.userId);
    return <div className="nav-folders"><span className="section-label">폴더</span>{folders.map((folder) => <a className="nav-item" href={`/library/${folder.id}`} key={folder.id}><span>{folder.name}</span></a>)}</div>;
  } catch {
    return null;
  }
}

export async function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  return <><nav aria-label="주 메뉴" className={mobile ? "nav nav-mobile" : "nav"}><a className="nav-item" href="/"><span>사이트 등록</span></a><a className="nav-item" href="/archives"><span>공개 탐색</span></a><a className="nav-item" href="/library"><span>내 보관함</span></a></nav><FolderNavigation /></>;
}
