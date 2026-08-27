"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "../theme-toggle";
import { useViewPreference } from "../use-preferences";
import type { ViewPreference } from "@/lib/preferences";

const VIEWS: Array<{ value: ViewPreference; label: string }> = [
  { value: "rendered", label: "렌더링 결과" },
  { value: "readable", label: "읽기" },
  { value: "original", label: "원문" },
];

export default function SettingsPage() {
  const { preference, ready, setPreference } = useViewPreference();
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (saved) { const timer = setTimeout(() => setSaved(false), 1800); return () => clearTimeout(timer); } }, [saved]);
  return (
    <main className="min-h-full bg-base-200 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-7">
        <header><p className="text-sm font-semibold tracking-widest text-primary">SETTINGS</p><h1 className="mt-2 text-4xl font-bold">사이트 환경설정</h1><p className="mt-3 text-base-content/70">이 브라우저에 표시 방식과 기본 열람 화면을 저장합니다.</p></header>
        <section className="card bg-base-100 shadow-sm"><div className="card-body gap-5">
          <div><h2 className="card-title">테마</h2><p className="mt-1 text-sm text-base-content/65">시스템 설정을 따르거나 직접 선택합니다.</p><div className="mt-3 max-w-xs"><ThemeToggle /></div></div>
          <div className="divider my-0" />
          <fieldset disabled={!ready}><legend className="font-semibold">기본 열람 화면</legend><p className="mt-1 text-sm text-base-content/65">아카이브 상세 화면을 열 때 먼저 표시할 화면입니다.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{VIEWS.map((view) => <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${preference === view.value ? "border-primary bg-primary/10" : "border-base-300"}`} key={view.value}><input checked={preference === view.value} className="radio radio-primary radio-sm" name="default-view" onChange={() => { setPreference(view.value); setSaved(true); }} type="radio" value={view.value} /><span>{view.label}</span></label>)}</div></fieldset>
          {saved ? <p aria-live="polite" className="text-sm text-success">저장되었습니다.</p> : null}
        </div></section>
      </div>
    </main>
  );
}
