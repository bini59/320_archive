import { connection } from "next/server";
import { getArchiveService } from "@/lib/archive/service";
import { requireAuthenticatedSession } from "@/lib/auth";
import { ActiveNavItem } from "./active-nav-item";

export async function FolderNavigation() {
  await connection();
  try {
    const identity = await requireAuthenticatedSession();
    const folders = getArchiveService().listFolders(identity.userId);
    return <div className="nav-folders"><span className="section-label">폴더</span>{folders.map((folder) => <ActiveNavItem href={`/library/${folder.id}`} key={folder.id}><span>{folder.name}</span></ActiveNavItem>)}</div>;
  } catch {
    return null;
  }
}

export async function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  return <><nav aria-label="주 메뉴" className={mobile ? "nav nav-mobile" : "nav"}><ActiveNavItem href="/"><span>사이트 등록</span></ActiveNavItem><ActiveNavItem href="/archives"><span>공개 탐색</span></ActiveNavItem><ActiveNavItem href="/library"><span>내 보관함</span></ActiveNavItem></nav><FolderNavigation /></>;
}
