"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CommandPalette() {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
      if (open && event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, a[href]"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    else triggerRef.current?.focus();
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    setOpen(false);
    router.push(value ? `/archives?q=${encodeURIComponent(value)}` : "/archives");
  }

  return (
    <>
      <button ref={triggerRef} aria-label="검색 열기" className="btn btn-ghost btn-sm gap-2" onClick={() => setOpen(true)} type="button">
        <span aria-hidden="true">⌕</span><span className="hidden sm:inline">검색</span><kbd className="kbd kbd-sm hidden sm:inline">Ctrl K</kbd>
      </button>
      {open ? (
        <div aria-label="검색" aria-modal="true" className="fixed inset-0 z-50 bg-black/40 p-4 pt-[15vh]" onClick={() => setOpen(false)} role="dialog">
          <form ref={dialogRef} className="mx-auto max-w-xl overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <label className="sr-only" htmlFor="command-search">아카이브 검색</label>
            <div className="flex items-center gap-3 border-b border-base-300 px-4"><span aria-hidden="true" className="text-xl">⌕</span><input autoFocus className="input input-ghost min-w-0 flex-1" id="command-search" onChange={(event) => setQuery(event.target.value)} placeholder="아카이브 검색..." value={query} /><kbd className="kbd kbd-sm">Esc</kbd></div>
            <div className="p-2"><button className="btn btn-ghost w-full justify-start font-normal" type="submit">검색 결과 보기 <span className="ml-auto text-xs text-base-content/50">Enter</span></button><a className="btn btn-ghost w-full justify-start font-normal" href="/settings" onClick={() => setOpen(false)}>사이트 환경설정</a></div>
          </form>
        </div>
      ) : null}
    </>
  );
}
