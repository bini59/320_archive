import { ArchiveForm } from "./archive-form";

export default async function Home({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>사이트 등록</h1>
          <p>{folderId ? "선택한 폴더에 사이트를 보관합니다." : "사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다."}</p>
        </div>
        <a className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</a>
      </div>
      <div className="card archive-form">
        <div className="card-head">보관할 페이지</div>
        <div className="card-body">
          <ArchiveForm folderId={folderId ?? null} returnTo={folderId ? `/library/${folderId}` : null} />
        </div>
      </div>
    </main>
  );
}
