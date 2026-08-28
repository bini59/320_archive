"use client";

import { useCallback, useRef, useState } from "react";
import { useActionState } from "react";
import { createArchiveAction } from "./actions";
import { initialArchiveFormState } from "./archive-form-state";
import { FolderCreateModal } from "./folder-create-modal";

type ArchiveFormProps = {
  folders: { id: string; name: string }[];
  folderId?: string | null;
  returnTo?: string | null;
};

export function ArchiveForm({
  folders,
  folderId = null,
  returnTo = null,
}: ArchiveFormProps) {
  const [availableFolders, setAvailableFolders] = useState(folders);
  const [selectedFolderId, setSelectedFolderId] = useState(folderId ?? "");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderModalKey, setFolderModalKey] = useState(0);
  const folderSelectRef = useRef<HTMLSelectElement>(null);
  const handleFolderCreated = useCallback((folder: { id: string; name: string }) => {
    setAvailableFolders((current) => [...current, folder]);
    setSelectedFolderId(folder.id);
  }, []);
  const closeFolderModal = useCallback(() => {
    setFolderModalOpen(false);
    requestAnimationFrame(() => folderSelectRef.current?.focus());
  }, []);
  const [state, formAction, pending] = useActionState(
    createArchiveAction,
    initialArchiveFormState,
  );

  return (
    <>
    <form action={formAction} className="archive-form-fields">
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <div className="form-row folder-picker-row archive-form-folder">
        <label className="field" htmlFor="archive-folder">
          <span className="field-label">보관 폴더</span>
          <select aria-describedby="archive-folder-error" aria-invalid={state.folderError ? true : undefined} className="input" id="archive-folder" name="folderId" onChange={(event) => { if (event.target.value === "__new__") { setFolderModalKey((key) => key + 1); setFolderModalOpen(true); } else setSelectedFolderId(event.target.value); }} ref={folderSelectRef} required value={selectedFolderId}>
            <option disabled value="">폴더를 선택하세요</option>
            {availableFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            <option value="__new__">+ 새 폴더 만들기</option>
          </select>
        </label>
      </div>
      <p aria-live="polite" className="mt-2 archive-form-errors" id="archive-folder-error">
        {state.folderError ? <span className="error">{state.folderError}</span> : null}
      </p>
      <div className="field archive-form-visibility">
        <label className="field-label" htmlFor="archive-visibility">공개 설정</label>
        <select className="input" defaultValue="private" id="archive-visibility" name="visibility"><option value="private">비공개</option><option value="public">공개</option></select>
      </div>
      <div className="field archive-form-url">
        <label className="field-label" htmlFor="archive-url">보관할 URL</label>
        <p className="dim text-xs" id="archive-url-description">
          공개된 HTTP 또는 HTTPS 주소를 입력하세요. 캡처에는 최대 10초가 걸릴 수 있습니다.
        </p>
      </div>
      <div className="form-row archive-form-url-row">
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
      <div className="archive-form-errors">
        <p aria-live="polite" id="archive-url-error">
          {state.error ? <span className="error">{state.error}</span> : null}
        </p>
      </div>
      <div className="field archive-form-tags">
        <label className="field-label" htmlFor="archive-tags">
          태그 <span className="dim">(선택)</span>
        </label>
        <p className="dim text-xs" id="archive-tags-description">
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
        <p aria-live="polite" id="archive-tags-error">
          {state.tagError ? <span className="error">{state.tagError}</span> : null}
        </p>
      </div>
    </form>
    <FolderCreateModal
      key={folderModalKey}
      onClose={closeFolderModal}
      onCreated={handleFolderCreated}
      open={folderModalOpen}
    />
    </>
  );
}
