import type { Folder } from "@/lib/archive/types";
import { createFolderAction } from "@/app/actions";
import { BoxIcon } from "@/app/icons";

type LibraryViewProps = {
  folders: Folder[];
  returnTo?: string;
};

export function LibraryView({ folders, returnTo }: LibraryViewProps) {
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>내 보관함</h1>
          <p>보관한 사이트를 폴더별로 관리하세요.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-head">새 폴더</div>
        <div className="card-body">
          <form action={createFolderAction} className="form-row">
            {returnTo === "/" ? <input name="returnTo" type="hidden" value="/" /> : null}
            <label className="field">
              <span className="field-label">새 폴더 이름</span>
              <input className="input" name="name" placeholder="새 폴더 이름" maxLength={100} required />
            </label>
            <button className="btn" type="submit">폴더 만들기</button>
          </form>
        </div>
      </div>
      <section aria-labelledby="folder-heading" className="folder-section">
        <div className="section-heading">
          <h2 id="folder-heading">폴더</h2>
          <span className="muted nums">{folders.length}개</span>
        </div>
        {folders.length ? (
          <div className="folder-grid">
            {folders.map((folder) => (
              <a className="folder-card" href={`/library/${folder.id}`} key={folder.id}>
                <span className="folder-icon"><BoxIcon size={20} /></span>
                <span className="folder-name">{folder.name}</span>
                <span className="folder-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="card empty"><span className="empty-mark"><BoxIcon size={17} /></span><strong>아직 폴더가 없습니다</strong><p>새 폴더를 만들어 보관한 사이트를 정리하세요.</p></div>
        )}
      </section>
    </main>
  );
}
