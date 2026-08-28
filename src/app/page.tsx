import { Suspense } from "react";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { HomeSkeleton } from "./skeletons";
import { ArchiveForm } from "./archive-form";

async function HomeContent({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;
  const identity = await requireAuthenticatedSession();
  const folders = getArchiveService().listFolders(identity.userId);
  const selectedFolder = folders.some((folder) => folder.id === folderId) ? folderId ?? null : null;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>사이트 등록</h1>
          <p>{selectedFolder ? "선택한 폴더에 사이트를 보관합니다." : "사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다."}</p>
        </div>
        <a className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</a>
      </div>
      <div className="card archive-form">
        <div className="card-head">보관할 페이지</div>
        <div className="card-body">
          <ArchiveForm folders={folders} folderId={selectedFolder} returnTo={selectedFolder ? `/library/${selectedFolder}` : null} />
        </div>
      </div>
    </main>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  return <Suspense fallback={<HomeSkeleton />}><HomeContent searchParams={searchParams} /></Suspense>;
}
