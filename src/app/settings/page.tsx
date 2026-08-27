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
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>사이트 환경설정</h1>
          <p>이 브라우저에 표시 방식과 기본 열람 화면을 저장합니다.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-head">테마</div>
        <div className="card-body">
          <p className="dim text-xs" style={{ marginBottom: 9 }}>시스템 설정을 따르거나 직접 선택합니다.</p>
          <div style={{ maxWidth: 200 }}><ThemeToggle /></div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-head">기본 열람 화면</div>
        <div className="card-body">
          <fieldset disabled={!ready} style={{ padding: 0, margin: 0, border: 0 }}>
            <legend className="dim text-xs" style={{ marginBottom: 9, padding: 0 }}>
              아카이브 상세 화면을 열 때 먼저 표시할 화면입니다.
            </legend>
            <div className="view-options">
              {VIEWS.map((view) => (
                <label className={`view-option${preference === view.value ? " view-option-active" : ""}`} key={view.value}>
                  <input
                    checked={preference === view.value}
                    name="default-view"
                    onChange={() => { setPreference(view.value); setSaved(true); }}
                    type="radio"
                    value={view.value}
                  />
                  <span>{view.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {saved ? <p aria-live="polite" className="toast">저장되었습니다.</p> : null}
    </main>
  );
}
