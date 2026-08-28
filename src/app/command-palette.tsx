"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";
import Link from "next/link";

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
      <button ref={triggerRef} aria-label="검색 열기" className="cmdk-btn" onClick={() => setOpen(true)} type="button">
        <SearchIcon size={13} />
        <span>아카이브 검색</span>
        <kbd style={{ marginLeft: "auto" }}>Ctrl K</kbd>
      </button>
      {open ? (
        <div aria-label="검색" aria-modal="true" className="palette-backdrop" onClick={() => setOpen(false)} role="dialog">
          <form ref={dialogRef} className="palette" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <label className="sr-only" htmlFor="command-search">아카이브 검색</label>
            <div className="palette-head">
              <SearchIcon size={15} />
              <input
                autoFocus
                id="command-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="아카이브 검색..."
                value={query}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-list">
              <button className="palette-item" type="submit">검색 결과 보기 <kbd>Enter</kbd></button>
              <Link className="palette-item" href="/settings" onClick={() => setOpen(false)}>사이트 환경설정</Link>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
