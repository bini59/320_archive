"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useViewPreference } from "@/app/use-preferences";

type View = "rendered" | "readable" | "original";

export function ArchiveViewer({ archiveId, readableHtml, hasRendered = false }: { archiveId: string; readableHtml: string | null; hasRendered?: boolean }) {
  const views = useMemo<View[]>(() => hasRendered ? ["rendered", "readable", "original"] : ["readable", "original"], [hasRendered]);
  const { preference, ready, setPreference } = useViewPreference();
  const [selected, setSelected] = useState<View>(hasRendered ? "rendered" : "readable");
  useEffect(() => {
    if (ready && views.includes(preference)) setSelected(preference);
  }, [preference, ready, views]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = views.length - 1;
    else return;
    event.preventDefault();
    selectView(views[next]);
    tabRefs.current[next]?.focus();
  }

  function selectView(view: View) {
    setSelected(view);
    setPreference(view);
  }

  const label = (view: View) => view === "rendered" ? "렌더링 결과" : view === "readable" ? "읽기" : "원문";

  return (
    <section aria-label="저장된 페이지" className="card archive-viewer">
      <div className="card-head">
        <div className="seg archive-tabs" role="tablist" aria-label="열람 방식" aria-orientation="horizontal">
          {views.map((view, index) => (
            <button
              key={view}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`${view}-tab`}
              type="button"
              role="tab"
              className={selected === view ? "active" : ""}
              aria-controls={`${view}-panel`}
              aria-selected={selected === view}
              tabIndex={selected === view ? 0 : -1}
              onClick={() => selectView(view)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
            >
              {label(view)}
            </button>
          ))}
        </div>
      </div>

      {hasRendered ? (
        <div id="rendered-panel" role="tabpanel" aria-labelledby="rendered-tab" hidden={selected !== "rendered"}>
          {selected === "rendered" ? (
            <iframe
              className="snapshot-frame"
              src={`/archives/${encodeURIComponent(archiveId)}/rendered`}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              title="보관된 페이지 렌더링 결과"
            />
          ) : null}
        </div>
      ) : null}

      <div id="readable-panel" role="tabpanel" aria-labelledby="readable-tab" hidden={selected !== "readable"}>
        {readableHtml === null ? (
          <div className="card-body">
            <p className="muted" role="status">이 보관본에는 읽기용 본문이 없습니다. 원문 탭에서 확인해 주세요.</p>
          </div>
        ) : (
          /* Trust boundary: this HTML is generated at capture time by createReadableHtml's strict allow-list. */
          <div
            className="readable"
            dangerouslySetInnerHTML={{ __html: readableHtml }}
          />
        )}
      </div>

      <div id="original-panel" role="tabpanel" aria-labelledby="original-tab" hidden={selected !== "original"}>
        {selected === "original" ? (
          <iframe
            className="snapshot-frame"
            src={`/archives/${encodeURIComponent(archiveId)}/original`}
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            title="보관된 페이지 원문"
          />
        ) : null}
      </div>
    </section>
  );
}
