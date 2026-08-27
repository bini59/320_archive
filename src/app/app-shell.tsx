import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

async function currentIdentity() {
  try {
    const sid = (await cookies()).get("sid")?.value;
    const identity = await verifySession(sid);
    return identity?.membership?.status === "active" ? identity : null;
  } catch {
    return null;
  }
}

function initials(name: string | null, email: string | null) {
  return (name || email || "?").slice(0, 1).toUpperCase();
}

function safeAvatarUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await currentIdentity();

  if (!identity) return children;

  const displayName = identity.name || identity.email || "사용자";
  const avatarUrl = safeAvatarUrl(identity.avatarUrl);

  return (
    <div className="flex min-h-full flex-1 bg-base-200">
      <aside className="hidden w-64 shrink-0 border-r border-base-300 bg-base-100 md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b border-base-300 px-5 py-4">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary font-bold text-primary-content">
            A
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">320 Archive</p>
            <p className="truncate text-xs text-base-content/60">개인용 아카이브</p>
          </div>
        </div>
        <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-3">
          <a className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-base-200" href="/">
            사이트 등록
          </a>
          <a className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-base-200" href="/archives">
            사이트 열람
          </a>
        </nav>
        <div className="mt-auto border-t border-base-300 p-3">
          <a className="flex items-center gap-3 rounded-lg p-2 hover:bg-base-200" href="/client">
            {avatarUrl ? (
              <img alt={`${displayName} 프로필 사진`} className="size-9 rounded-full object-cover" src={avatarUrl} />
            ) : (
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-base-300 text-sm font-semibold">
                {initials(identity.name, identity.email)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              <span className="block truncate text-xs text-base-content/60">계정 설정</span>
            </span>
          </a>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="navbar sticky top-0 z-20 min-h-16 border-b border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-6">
          <div className="flex-1">
            <a className="text-lg font-bold tracking-tight" href="/">320 Archive</a>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-base-content/70 sm:inline">{displayName}</span>
            <a aria-label="계정 설정" className="avatar placeholder" href="/client">
              <span className="size-9 rounded-full bg-base-300 text-sm font-semibold">
                {avatarUrl ? <img alt="" className="size-9 rounded-full object-cover" src={avatarUrl} /> : initials(identity.name, identity.email)}
              </span>
            </a>
          </div>
        </header>
        <div className="border-b border-base-300 bg-base-100 px-4 py-2 md:hidden">
          <nav aria-label="주 메뉴" className="flex gap-2">
            <a className="btn btn-sm btn-ghost" href="/">사이트 등록</a>
            <a className="btn btn-sm btn-ghost" href="/archives">사이트 열람</a>
          </nav>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
