import { connection } from "next/server";
import { adminSignOutAction } from "@/app/actions";
import { isAdminConfigured, isArchiveAdmin } from "@/lib/admin";
import { AdminSignInForm } from "./admin-sign-in-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  await connection();
  const configured = isAdminConfigured();
  const signedIn = configured && await isArchiveAdmin();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>관리자 인증</h1>
          <p>관리자는 아카이브 상세 화면에서 태그를 편집하고 아카이브를 삭제할 수 있습니다.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-body">
          {!configured ? (
            <p className="muted" role="status">관리 기능이 설정되지 않았습니다.</p>
          ) : signedIn ? (
            <form action={adminSignOutAction}>
              <p className="muted" role="status">관리자로 인증되어 있습니다.</p>
              <div className="mt-3 chips">
                <a className="btn btn-sm" href="/archives">공개 아카이브로</a>
                <button className="btn btn-sm btn-ghost" type="submit">관리자 인증 해제</button>
              </div>
            </form>
          ) : (
            <AdminSignInForm />
          )}
        </div>
      </div>
    </div>
  );
}
