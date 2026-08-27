import Link from "next/link";

export default function ArchiveNotFound() {
  return (
    <main className="hero min-h-full bg-base-200 px-4">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-widest text-error">404</p>
          <h1 className="mt-3 text-4xl font-bold">아카이브를 찾을 수 없습니다</h1>
          <p className="py-6 text-base-content/70">
            주소가 올바른지 확인하거나 새 URL을 보관해 주세요.
          </p>
          <Link className="btn btn-neutral" href="/">홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}
