import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { ArchiveViewer } from "./archive-viewer";
import { ArchiveStatusAction } from "./archive-status-action";
import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError, type ArchiveStatus } from "@/lib/archive/types";
import { captureFailurePresentation } from "@/app/archive-form-state";
import { ArchiveDetailSkeleton } from "../../skeletons";

const statusPresentation: Record<ArchiveStatus, { badge: string; label: string; description: string }> = {
  pending: { badge: "badge", label: "캡처 중", description: "페이지를 캡처하고 있습니다." },
  saved: { badge: "badge badge-accent", label: "저장 완료", description: "캡처한 페이지를 안전하게 열람할 수 있습니다." },
  failed: { badge: "badge badge-danger", label: "저장 실패", description: "페이지를 저장하지 못했습니다." },
};

function failureDescription(code: Parameters<typeof captureFailurePresentation>[0] | null): string {
  if (!code) return "페이지를 저장하지 못했습니다.";
  const kind = captureFailurePresentation(code).kind;
  if (kind === "quota") return "저장 공간이 부족합니다. 공간을 확보한 뒤 다시 시도해 주세요.";
  if (kind === "rate") return "요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  if (kind === "concurrency") return "현재 처리 중인 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (kind === "permanent") return "URL 또는 대상 페이지 조건을 확인한 뒤 새로 등록해 주세요.";
  return "일시적인 문제로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ArchiveContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  await connection();
  const service = getArchiveService();
  const identity = await verifySession((await cookies()).get("sid")?.value);
  const ownerId = identity?.membership?.status === "active" ? identity.userId : undefined;
  const archive = ownerId
    ? (service.findOwnedById(ownerId, id) ?? service.findPublicById(id))
    : service.findPublicById(id);
  if (!archive) notFound();

  const contentOwnerId = archive.visibility === "private" ? ownerId : undefined;
  const status = statusPresentation[archive.status];
  const failureKind = archive.failureCode ? captureFailurePresentation(archive.failureCode).kind : null;
  let readableHtml: string | null = null;
  let hasRendered = false;
  if (archive.status === "saved" && archive.snapshot) {
    try {
      hasRendered = Boolean(await service.findContent(id, "rendered", contentOwnerId));
    } catch (error) {
      if (!(error instanceof SnapshotContentNotFoundError)) throw error;
    }
    try {
      const result = await service.findContent(id, "readable", contentOwnerId);
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
                <p className="error" role="status">{archive.failureMessage ?? failureDescription(archive.failureCode)}</p>
                <p className="muted mt-2">{failureDescription(archive.failureCode)}</p>
                <div className="mt-3">
                  <ArchiveStatusAction
                    archiveId={archive.id}
                    retryable={Boolean(
                      ownerId && archive.ownerId === ownerId && archive.failureCode && captureFailurePresentation(archive.failureCode).retryable,
                    )}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <p className="muted" role="status">캡처 요청이 처리 중입니다. 진행률은 제공되지 않으며, 새로고침하지 않아도 됩니다.</p>
                <p className="dim text-xs mt-2">장시간 그대로라면 잠시 후 이 페이지를 다시 열어 상태를 확인하세요.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="card detail-side">
          <div className="detail-section">
            <p className="section-label">상태</p>
            <span className={status.badge}>{status.label}{failureKind ? ` · ${failureKind === "retryable" ? "일시적" : failureKind === "permanent" ? "입력 확인" : failureKind === "rate" ? "요청 제한" : failureKind === "quota" ? "공간 부족" : "동시 처리 제한"}` : ""}</span>
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

export default function ArchivePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<ArchiveDetailSkeleton />}><ArchiveContent params={params} /></Suspense>;
}
