"use client";

import { useActionState } from "react";
import {
  createArchiveAction,
} from "./actions";
import { initialArchiveFormState } from "./archive-form-state";

export function ArchiveForm({ folderId = null, returnTo = null }: { folderId?: string | null; returnTo?: string | null } = {}) {
  const [state, formAction, pending] = useActionState(
    createArchiveAction,
    initialArchiveFormState,
  );

  return (
    <form action={formAction}>
      {folderId ? <input name="folderId" type="hidden" value={folderId} /> : null}
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <label className="field-label" htmlFor="archive-visibility">공개 설정</label>
      <select className="input" defaultValue="private" id="archive-visibility" name="visibility"><option value="private">비공개</option><option value="public">공개</option></select>
      <label className="field-label" htmlFor="archive-url">
        보관할 URL
      </label>
      <p className="dim mb-2 text-xs" id="archive-url-description">
        공개된 HTTP 또는 HTTPS 주소를 입력하세요. 캡처에는 최대 10초가 걸릴 수 있습니다.
      </p>
      <div className="form-row">
        <input
          aria-describedby="archive-url-description archive-url-error"
          aria-invalid={state.error ? true : undefined}
          className="input mono"
          id="archive-url"
          maxLength={8192}
          name="url"
          placeholder="https://example.com/article"
          required
          type="url"
        />
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "캡처 중…" : "아카이브 추가"}
        </button>
      </div>
      <label className="field-label mt-5" htmlFor="archive-tags">
        태그 <span className="dim">(선택)</span>
      </label>
      <p className="dim mb-2 text-xs" id="archive-tags-description">
        쉼표로 구분해 최대 10개까지 입력하세요. 예: 개발, 읽을거리
      </p>
      <input
        aria-describedby="archive-tags-description archive-tags-error"
        aria-invalid={state.tagError ? true : undefined}
        className="input"
        id="archive-tags"
        maxLength={329}
        name="tags"
        placeholder="개발, 읽을거리"
        type="text"
      />
      <p aria-live="polite" className="mt-3" id="archive-tags-error">
        {state.tagError ? <span className="error">{state.tagError}</span> : null}
      </p>
      <p aria-live="polite" className="mt-3" id="archive-url-error">
        {state.error ? <span className="error">{state.error}</span> : null}
      </p>
    </form>
  );
}
