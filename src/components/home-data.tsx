import { ArchiveForm } from "@/app/archive-form";
import type { Folder } from "@/lib/archive/types";

export function HomeDataView({ folders, selectedFolderId }: { folders: Folder[]; selectedFolderId: string | null }) {
  return <><p className="mb-3">{selectedFolderId ? "선택한 폴더에 사이트를 보관합니다." : "사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다."}</p><div className="card archive-form"><div className="card-head">보관할 페이지</div><div className="card-body"><ArchiveForm folders={folders} folderId={selectedFolderId} returnTo={selectedFolderId ? `/library/${selectedFolderId}` : null} /></div></div></>;
}
