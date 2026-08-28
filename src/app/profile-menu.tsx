"use client";

import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "./actions";
import { ExternalLinkIcon, LogOutIcon, SettingsIcon, UserIcon } from "./icons";
import Link from "next/link";

export function ProfileMenu({
  accountCenterHref,
  avatarUrl,
  displayName,
  email,
  fallback,
}: {
  accountCenterHref: string;
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  fallback: string;
}) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const forward = event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey);
      event.preventDefault();
      items[(current + (forward ? 1 : -1) + items.length) % items.length].focus();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="프로필 메뉴"
        className="avatar avatar-btn"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        {avatarUrl ? <img alt="" src={avatarUrl} /> : fallback}
      </button>
      {open ? (
        <div aria-label="프로필 메뉴" className="menu" id={menuId} ref={menuRef} role="menu">
          <div className="menu-head">
            <span className="avatar">{avatarUrl ? <img alt="" src={avatarUrl} /> : fallback}</span>
            <span className="menu-identity">
              <strong>{displayName}</strong>
              {email ? <span className="dim">{email}</span> : null}
            </span>
          </div>
          <div className="menu-list">
            <a
              className="menu-item"
              href={accountCenterHref}
              onClick={() => setOpen(false)}
              rel="noreferrer noopener"
              role="menuitem"
              target="_blank"
            >
              <UserIcon />
              <span>계정센터</span>
              <span aria-hidden="true" className="menu-trail"><ExternalLinkIcon /></span>
            </a>
            <Link className="menu-item" href="/settings" onClick={() => setOpen(false)} role="menuitem">
              <SettingsIcon />
              <span>환경설정</span>
            </Link>
            <form action={logoutAction}>
              <button className="menu-item menu-item-danger" role="menuitem" type="submit">
                <LogOutIcon />
                <span>로그아웃</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
