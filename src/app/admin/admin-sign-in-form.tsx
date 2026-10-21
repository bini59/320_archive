"use client";

import { useActionState } from "react";
import { adminSignInAction } from "@/app/actions";
import { initialAdminSignInState } from "@/app/archive-admin-state";

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(adminSignInAction, initialAdminSignInState);
  return (
    <form action={action} className="field">
      <label className="field-label" htmlFor="admin-secret">관리자 비밀키</label>
      <input
        aria-describedby="admin-secret-error"
        aria-invalid={state.error ? true : undefined}
        autoComplete="current-password"
        className="input mono"
        disabled={pending}
        id="admin-secret"
        name="secret"
        required
        type="password"
      />
      <div className="mt-3">
        <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "확인 중…" : "인증"}</button>
      </div>
      <p aria-live="polite" id="admin-secret-error">{state.error ? <span className="error">{state.error}</span> : null}</p>
    </form>
  );
}
