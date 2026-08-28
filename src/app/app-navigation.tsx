import type { Folder } from "@/lib/archive/types";
import { ActiveNavItem } from "./active-nav-item";

export function FolderNavigation({ folders }: { folders: Folder[] }) {
  if (!folders.length) return null;
  return <div className="nav-folders mobile-nav-folders"><span className="section-label">폴더</span>{folders.map((folder) => <ActiveNavItem href={`/library/${folder.id}`} key={folder.id}><span>{folder.name}</span></ActiveNavItem>)}</div>;
}

export function AppNavigation({ folders, mobile = false }: { folders: Folder[]; mobile?: boolean }) {
  return <><nav aria-label="주 메뉴" className={mobile ? "nav nav-mobile" : "nav"}><ActiveNavItem href="/"><span>사이트 등록</span></ActiveNavItem><ActiveNavItem href="/archives"><span>공개 탐색</span></ActiveNavItem><ActiveNavItem exact href="/library"><span>내 보관함</span></ActiveNavItem></nav><FolderNavigation folders={folders} /></>;
}
