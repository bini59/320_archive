import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getArchiveService } from "@/lib/archive/service";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  await connection();
  const archive = getArchiveService().findById(id);
  if (!archive) notFound();

  const createdAt = new Date(archive.createdAt);

  return (
    <main className="min-h-full bg-base-200 px-4 py-16">
      <article className="card mx-auto max-w-2xl bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="card-title text-3xl">보관 요청 상세</h1>
            <span className="badge badge-warning">{archive.status}</span>
          </div>
          <dl className="space-y-5">
            <div>
              <dt className="text-sm font-semibold text-base-content/60">원본 URL</dt>
              <dd className="mt-1 break-all">
                <a className="link link-primary" href={archive.originalUrl} rel="noreferrer">
                  {archive.originalUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-base-content/60">상태</dt>
              <dd className="mt-1">{archive.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-base-content/60">생성 시각</dt>
              <dd className="mt-1">
                <time dateTime={archive.createdAt}>
                  {Number.isNaN(createdAt.valueOf())
                    ? archive.createdAt
                    : createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </time>
              </dd>
            </div>
          </dl>
          <div className="card-actions justify-end">
            <a className="btn btn-ghost" href="/">다른 URL 보관하기</a>
          </div>
        </div>
      </article>
    </main>
  );
}
