import { ArchiveForm } from "./archive-form";

export default function Home() {
  return (
    <main className="hero min-h-full bg-base-200">
      <div className="hero-content text-center">
        <div className="w-full max-w-xl">
          <p className="text-sm font-semibold tracking-widest text-base-content/60">ARCHIVE</p>
          <h1 className="mt-3 text-5xl font-bold">개인용 아카이브</h1>
          <p className="py-6 text-base-content/70">
            사라질 수 있는 웹 콘텐츠를 오래 보관할 공간입니다.
          </p>
          <ArchiveForm />
          <a className="btn btn-ghost mt-4" href="/archives">공개 아카이브 둘러보기</a>
        </div>
      </div>
    </main>
  );
}
