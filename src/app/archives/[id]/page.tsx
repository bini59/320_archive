import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getArchiveService } from "@/lib/archive/service";
import type { ArchiveStatus } from "@/lib/archive/types";

const statusPresentation: Record<ArchiveStatus, { badge: string; label: string; description: string }> = {
  pending: {
    badge: "badge-warning",
    label: "캡처 중",
    description: "페이지를 캡처하고 있습니다.",
  },
  saved: {
    badge: "badge-success",
    label: "저장 완료",
    description: "페이지 원문과 메타데이터를 안전하게 저장했습니다.",
  },
  failed: {
    badge: "badge-error",
    label: "저장 실패",
    description: "페이지를 저장하지 못했습니다.",
  },
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

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

  const status = statusPresentation[archive.status];

  return (
    <main className="min-h-full bg-base-200 px-4 py-16">
      <article className="card mx-auto max-w-2xl bg-base-100 shadow-xl">
        <div className="card-body gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="card-title text-3xl">보관 요청 상세</h1>
            <span className={`badge ${status.badge}`}>{status.label}</span>
          </div>
          <p className="text-base-content/70">{status.description}</p>
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
              <dd className="mt-1">{status.label}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-base-content/60">생성 시각</dt>
              <dd className="mt-1">
                <time dateTime={archive.createdAt}>
                  {formatDate(archive.createdAt)}
                </time>
              </dd>
            </div>
            {archive.status === "saved" && archive.snapshot ? (
              <>
                <div>
                  <dt className="text-sm font-semibold text-base-content/60">제목</dt>
                  <dd className="mt-1">{archive.snapshot.title ?? "제목 없음"}</dd>
                </div>
                {archive.snapshot.description ? (
                  <div>
                    <dt className="text-sm font-semibold text-base-content/60">설명</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{archive.snapshot.description}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-sm font-semibold text-base-content/60">최종 URL</dt>
                  <dd className="mt-1 break-all">
                    <a className="link link-primary" href={archive.snapshot.finalUrl} rel="noreferrer">
                      {archive.snapshot.finalUrl}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-base-content/60">캡처 시각</dt>
                  <dd className="mt-1">
                    <time dateTime={archive.snapshot.capturedAt}>{formatDate(archive.snapshot.capturedAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-base-content/60">원문 크기</dt>
                  <dd className="mt-1">{archive.snapshot.byteLength.toLocaleString("ko-KR")} bytes</dd>
                </div>
              </>
            ) : null}
            {archive.status === "failed" ? (
              <div>
                <dt className="text-sm font-semibold text-base-content/60">실패 사유</dt>
                <dd className="mt-1 text-error">
                  {archive.failureMessage ?? "페이지를 저장하지 못했습니다."}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="card-actions justify-end">
            <a className="btn btn-ghost" href="/">다른 URL 보관하기</a>
          </div>
        </div>
      </article>
    </main>
  );
}
