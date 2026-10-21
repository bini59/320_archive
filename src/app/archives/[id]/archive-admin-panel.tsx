"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { deleteArchiveAction, updateArchiveTagsAction } from "@/app/actions";
import { initialArchiveAdminState, type ArchiveAdminState } from "@/app/archive-admin-state";

function ResultMessage({ state, id }: { state: ArchiveAdminState; id: string }) {
  if (!state.message) return <p aria-live="polite" id={id} />;
  return (
    <p aria-live="polite" id={id}>
      <span className={state.kind === "success" ? "notice" : "error"} role="status">{state.message}</span>
    </p>
  );
}

export function ArchiveAdminPanel({ archiveId, tags }: { archiveId: string; tags: string }) {
  const [tagState, tagAction, tagPending] = useActionState(updateArchiveTagsAction, initialArchiveAdminState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteArchiveAction, initialArchiveAdminState);
  const [confirming, setConfirming] = useState(false);
  const deleted = deleteState.kind === "partial";

  return (
    <div className="detail-section archive-admin">
      <p className="section-label">관리</p>
      <form action={tagAction} className="field">
        <input name="archiveId" type="hidden" value={archiveId} />
        <label className="field-label" htmlFor="archive-admin-tags">태그 편집</label>
        <p className="dim text-xs" id="archive-admin-tags-description">쉼표로 구분해 최대 10개까지 입력하세요. 비우면 모든 태그를 제거합니다.</p>
        <input
          aria-describedby="archive-admin-tags-description archive-admin-tags-result"
          aria-invalid={tagState.kind === "validation" ? true : undefined}
          className="input"
          defaultValue={tags}
          disabled={tagPending || deleted}
          id="archive-admin-tags"
          maxLength={329}
          name="tags"
          placeholder="개발, 읽을거리"
          type="text"
        />
        <div className="mt-2">
          <button className="btn btn-sm" disabled={tagPending || deleted} type="submit">{tagPending ? "저장 중…" : "태그 저장"}</button>
        </div>
        <ResultMessage id="archive-admin-tags-result" state={tagState} />
      </form>

      <div className="archive-admin-delete mt-3">
        {deleted ? (
          <Link className="btn btn-sm" href="/archives">목록으로</Link>
        ) : confirming ? (
          <form action={deleteAction}>
            <input name="archiveId" type="hidden" value={archiveId} />
            <input name="confirm" type="hidden" value="delete" />
            <p className="muted text-xs">이 아카이브와 저장된 스냅샷, 첨부 파일이 영구 삭제됩니다. 되돌릴 수 없습니다.</p>
            <div className="mt-2 chips">
              <button className="btn btn-sm btn-danger" disabled={deletePending} type="submit">{deletePending ? "삭제 중…" : "영구 삭제"}</button>
              <button className="btn btn-sm btn-ghost" disabled={deletePending} onClick={() => setConfirming(false)} type="button">취소</button>
            </div>
          </form>
        ) : (
          <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)} type="button">아카이브 삭제</button>
        )}
        <ResultMessage id="archive-admin-delete-result" state={deleteState} />
        {deleted ? (
          <form action={deleteAction} className="mt-2">
            <input name="archiveId" type="hidden" value={archiveId} />
            <input name="confirm" type="hidden" value="delete" />
            <button className="btn btn-sm" disabled={deletePending} type="submit">{deletePending ? "재시도 중…" : "파일 정리 재시도"}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
