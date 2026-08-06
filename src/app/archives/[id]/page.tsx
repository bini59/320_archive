import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArchiveViewer } from "./archive-viewer";
import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError, type ArchiveStatus } from "@/lib/archive/types";

const statusPresentation: Record<ArchiveStatus, { badge: string; label: string; description: string }> = {
  pending: { badge: "badge-warning", label: "캡처 중", description: "페이지를 캡처하고 있습니다." },
  saved: { badge: "badge-success", label: "저장 완료", description: "캡처한 페이지를 안전하게 열람할 수 있습니다." },
  failed: { badge: "badge-error", label: "저장 실패", description: "페이지를 저장하지 못했습니다." },
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function ArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  await connection();
  const service = getArchiveService();
  const archive = service.findById(id);
  if (!archive) notFound();

  const status = statusPresentation[archive.status];
  let readableHtml: string | null = null;
  let hasRendered = false;
  if (archive.status === "saved" && archive.snapshot) {
    try {
      hasRendered = Boolean(await service.findContent(id, "rendered"));
    } catch (error) {
      if (!(error instanceof SnapshotContentNotFoundError)) throw error;
    }
    try {
      const result = await service.findContent(id, "readable");
      if (result) readableHtml = new TextDecoder().decode(result.content.bytes);
    } catch (error) {
      if (!(error instanceof SnapshotContentNotFoundError)) throw error;
    }
  }

  return (
    <main className="min-h-full bg-base-200 px-4 py-10 sm:py-16">
      <article className="card mx-auto max-w-5xl bg-base-100 shadow-xl">
        <div className="card-body gap-7">
          <header className="space-y-5 border-b border-base-300 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="card-title text-3xl">{archive.snapshot?.title ?? "보관 요청 상세"}</h1>
              <span className={`badge ${status.badge}`}>{status.label}</span>
            </div>
            <p className="text-base-content/70">{status.description}</p>
            {archive.status === "saved" && archive.snapshot?.description ? (
              <p className="text-base-content/80">{archive.snapshot.description}</p>
            ) : null}
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div className="sm:col-span-3">
                <dt className="font-semibold text-base-content/60">원본 URL</dt>
                <dd className="mt-1 break-all">{archive.originalUrl}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/60">상태</dt>
                <dd className="mt-1">{status.label}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/60">요청 시각</dt>
                <dd className="mt-1"><time dateTime={archive.createdAt}>{formatDate(archive.createdAt)}</time></dd>
              </div>
              {archive.status === "saved" && archive.snapshot ? (
                <div>
                  <dt className="font-semibold text-base-content/60">캡처 시각</dt>
                  <dd className="mt-1"><time dateTime={archive.snapshot.capturedAt}>{formatDate(archive.snapshot.capturedAt)}</time></dd>
                </div>
              ) : null}
            </dl>
          </header>

          {archive.status === "saved" && archive.snapshot ? (
            <ArchiveViewer archiveId={archive.id} readableHtml={readableHtml} hasRendered={hasRendered} />
          ) : archive.status === "failed" ? (
            <div className="alert alert-error" role="status">
              <span>{archive.failureMessage ?? "페이지를 저장하지 못했습니다."}</span>
            </div>
          ) : (
            <div className="alert alert-info" role="status"><span>캡처가 끝나면 읽기 화면을 표시합니다.</span></div>
          )}

          <div className="card-actions justify-end">
            <a className="btn btn-ghost" href="/">다른 URL 보관하기</a>
          </div>
        </div>
      </article>
    </main>
  );
}
