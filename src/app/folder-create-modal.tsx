"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFolderModalAction } from "./actions";
import { initialFolderFormState } from "./folder-form-state";

type FolderCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (folder: { id: string; name: string }) => void;
};

export function FolderCreateModal({ open, onClose, onCreated }: FolderCreateModalProps) {
  const [state, formAction, pending] = useActionState(
    async (_previousState: typeof initialFolderFormState, formData: FormData) => createFolderModalAction(formData),
    initialFolderFormState,
  );
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
  }, [open]);

  useEffect(() => {
    if (state.folder) {
      onCreated(state.folder);
      onClose();
    }
  }, [onClose, onCreated, state.folder]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input:not([type=hidden])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      aria-label="새 폴더 만들기"
      aria-modal="true"
      className="folder-modal-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <form
        action={formAction}
        className="folder-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <input name="modal" type="hidden" value="true" />
        <div className="folder-modal-head">
          <div>
            <p className="section-label">사이트 등록</p>
            <h2>새 폴더 만들기</h2>
          </div>
          <button aria-label="폴더 만들기 닫기" className="btn btn-ghost btn-sm" onClick={onClose} type="button">닫기</button>
        </div>
        <label className="field" htmlFor="new-folder-name">
          <span className="field-label">폴더 이름</span>
          <input
            aria-describedby="new-folder-error"
            aria-invalid={state.error ? true : undefined}
            className="input"
            id="new-folder-name"
            maxLength={100}
            name="name"
            placeholder="예: 읽을거리"
            required
          />
        </label>
        <p aria-live="polite" className="folder-modal-error" id="new-folder-error">{state.error}</p>
        <div className="folder-modal-actions">
          <button className="btn btn-ghost" onClick={onClose} type="button">취소</button>
          <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "만드는 중…" : "폴더 만들기"}</button>
        </div>
      </form>
    </div>
  );
}
