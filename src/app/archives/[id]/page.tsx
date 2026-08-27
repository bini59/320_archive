import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArchiveViewer } from "./archive-viewer";
import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError, type ArchiveStatus } from "@/lib/archive/types";

const statusPresentation: Record<ArchiveStatus, { badge: string; label: string; description: string }> = {
  pending: { badge: "badge", label: "캡처 중", description: "페이지를 캡처하고 있습니다." },
  saved: { badge: "badge badge-accent", label: "저장 완료", description: "캡처한 페이지를 안전하게 열람할 수 있습니다." },
  failed: { badge: "badge badge-danger", label: "저장 실패", description: "페이지를 저장하지 못했습니다." },
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
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{archive.snapshot?.title ?? "보관 요청 상세"}</h1>
          <p>{status.description}</p>
        </div>
        <a className="btn btn-ghost" href="/">다른 URL 보관하기</a>
      </div>

      <div className="detail-layout">
        <div>
          {archive.status === "saved" && archive.snapshot ? (
            <ArchiveViewer archiveId={archive.id} readableHtml={readableHtml} hasRendered={hasRendered} />
          ) : archive.status === "failed" ? (
            <div className="card">
              <div className="card-body">
                <p className="error" role="status">{archive.failureMessage ?? "페이지를 저장하지 못했습니다."}</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <p className="muted" role="status">캡처가 끝나면 읽기 화면을 표시합니다.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="card detail-side">
          <div className="detail-section">
            <p className="section-label">상태</p>
            <span className={status.badge}>{status.label}</span>
          </div>
          <div className="detail-section">
            <p className="section-label">원본 URL</p>
            <a className="mono break-all" href={archive.originalUrl} rel="noreferrer noopener nofollow" target="_blank">{archive.originalUrl}</a>
          </div>
          <div className="detail-section">
            <p className="section-label">메타</p>
            {archive.status === "saved" && archive.snapshot?.description ? (
              <p className="muted" style={{ marginBottom: 9 }}>{archive.snapshot.description}</p>
            ) : null}
            <p className="dim text-xs">요청 시각</p>
            <p className="mono nums" style={{ marginBottom: 9 }}>
              <time dateTime={archive.createdAt}>{formatDate(archive.createdAt)}</time>
            </p>
            {archive.status === "saved" && archive.snapshot ? (
              <>
                <p className="dim text-xs">캡처 시각</p>
                <p className="mono nums">
                  <time dateTime={archive.snapshot.capturedAt}>{formatDate(archive.snapshot.capturedAt)}</time>
                </p>
              </>
            ) : null}
          </div>
          {archive.tags.length ? (
            <div className="detail-section">
              <p className="section-label">태그</p>
              <div className="chips">
                {archive.tags.map((tag) => <a className="chip" href={`/archives?tag=${encodeURIComponent(tag.slug)}`} key={tag.slug}>#{tag.name}</a>)}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
