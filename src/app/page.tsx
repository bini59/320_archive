import { ArchiveForm } from "./archive-form";

export default function Home() {
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>사이트 등록</h1>
          <p>사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다.</p>
        </div>
        <a className="btn btn-ghost" href="/archives">공개 아카이브 둘러보기</a>
      </div>
      <div className="card archive-form">
        <div className="card-head">보관할 페이지</div>
        <div className="card-body">
          <ArchiveForm />
        </div>
      </div>
    </main>
  );
}
