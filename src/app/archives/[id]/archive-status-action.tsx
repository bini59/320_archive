"use client";

import { useActionState } from "react";
import { retryArchiveAction } from "@/app/actions";
import { initialArchiveFormState } from "@/app/archive-form-state";

export function ArchiveStatusAction({ archiveId, retryable }: { archiveId: string; retryable: boolean }) {
  const [state, action, pending] = useActionState(retryArchiveAction, initialArchiveFormState);

  if (!retryable && !state.error) {
    return <p className="muted" role="status">입력한 URL이나 보관 조건을 확인한 뒤 새 URL로 다시 등록해 주세요.</p>;
  }

  return (
    <div className="archive-status-action">
      <p className="muted">일시적인 문제라면 같은 아카이브에서 다시 시도할 수 있습니다.</p>
      <form action={action}>
        <input name="archiveId" type="hidden" value={archiveId} />
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "다시 시도 중…" : "다시 시도"}
        </button>
      </form>
      {pending ? <p className="muted" role="status">캡처하고 저장하는 중입니다. 진행률은 표시하지 않으며 새로고침하지 않아도 됩니다.</p> : null}
      {state.error ? <p aria-live="polite" className="error" role="status">{state.error}</p> : null}
    </div>
  );
}
