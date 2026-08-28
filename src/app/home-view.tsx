import type { Folder } from "@/lib/archive/types";
import { ArchiveForm } from "./archive-form";

type HomeViewProps = {
  folders: Folder[];
  selectedFolderId: string | null;
};

export function HomeView({ folders, selectedFolderId }: HomeViewProps) {
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>사이트 등록</h1>
          <p>{selectedFolderId ? "선택한 폴더에 사이트를 보관합니다." : "사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다."}</p>
        </div>
        <a className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</a>
      </div>
      <div className="card archive-form">
        <div className="card-head">보관할 페이지</div>
        <div className="card-body">
          <ArchiveForm folders={folders} folderId={selectedFolderId} returnTo={selectedFolderId ? `/library/${selectedFolderId}` : null} />
        </div>
      </div>
    </main>
  );
}
