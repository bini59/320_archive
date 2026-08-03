"use client";

import { useActionState } from "react";
import {
  createArchiveAction,
} from "./actions";
import { initialArchiveFormState } from "./archive-form-state";

export function ArchiveForm() {
  const [state, formAction, pending] = useActionState(
    createArchiveAction,
    initialArchiveFormState,
  );

  return (
    <form action={formAction} className="mt-8 text-left">
      <label className="label font-semibold" htmlFor="archive-url">
        보관할 URL
      </label>
      <p className="mb-2 text-sm text-base-content/65" id="archive-url-description">
        공개된 HTTP 또는 HTTPS 주소를 입력하세요.
      </p>
      <div className="join w-full">
        <input
          aria-describedby="archive-url-description archive-url-error"
          aria-invalid={state.error ? true : undefined}
          className="input input-bordered join-item min-w-0 flex-1"
          id="archive-url"
          name="url"
          placeholder="https://example.com/article"
          required
          type="url"
        />
        <button className="btn btn-primary join-item" disabled={pending} type="submit">
          {pending ? "저장 중…" : "아카이브 추가"}
        </button>
      </div>
      <p
        className="mt-2 min-h-6 text-sm text-error"
        id="archive-url-error"
        aria-live="polite"
      >
        {state.error}
      </p>
    </form>
  );
}
