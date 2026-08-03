"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type View = "readable" | "original";
const views: View[] = ["readable", "original"];

export function ArchiveViewer({ archiveId, readableHtml }: { archiveId: string; readableHtml: string | null }) {
  const [selected, setSelected] = useState<View>("readable");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = views.length - 1;
    else return;
    event.preventDefault();
    setSelected(views[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <section aria-label="저장된 페이지">
      <div className="tabs tabs-border" role="tablist" aria-label="열람 방식">
        {views.map((view, index) => (
          <button
            key={view}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`${view}-tab`}
            type="button"
            role="tab"
            className={`tab ${selected === view ? "tab-active" : ""}`}
            aria-controls={`${view}-panel`}
            aria-selected={selected === view}
            tabIndex={selected === view ? 0 : -1}
            onClick={() => setSelected(view)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            {view === "readable" ? "읽기" : "원문"}
          </button>
        ))}
      </div>

      <div id="readable-panel" role="tabpanel" aria-labelledby="readable-tab" hidden={selected !== "readable"} className="pt-6">
        {readableHtml === null ? (
          <div className="alert" role="status"><span>이 보관본에는 읽기용 본문이 없습니다. 원문 탭에서 확인해 주세요.</span></div>
        ) : (
          /* Trust boundary: this HTML is generated at capture time by createReadableHtml's strict allow-list. */
          <div
            className="mx-auto max-w-3xl space-y-4 text-[1.05rem] leading-8 [&_blockquote]:border-l-4 [&_blockquote]:border-base-300 [&_blockquote]:pl-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:my-4 [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: readableHtml }}
          />
        )}
      </div>

      <div id="original-panel" role="tabpanel" aria-labelledby="original-tab" hidden={selected !== "original"} className="pt-6">
        {selected === "original" ? (
          <iframe
            className="h-[70vh] w-full rounded-box border border-base-300 bg-white"
            src={`/archives/${encodeURIComponent(archiveId)}/original`}
            sandbox=""
            referrerPolicy="no-referrer"
            title="보관된 페이지 원문"
          />
        ) : null}
      </div>
    </section>
  );
}
