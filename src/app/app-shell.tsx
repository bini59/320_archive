import { cookies } from "next/headers";
import { accountCenterUrl, verifySession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { ArchiveShell } from "./archive-shell";

async function currentIdentity() {
  try {
    const sid = (await cookies()).get("sid")?.value;
    const identity = await verifySession(sid);
    return identity?.membership?.status === "active" ? identity : null;
  } catch {
    return null;
  }
}

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await currentIdentity();

  // Public visitors (shared archive links) get the page without the signed-in shell.
  if (!identity) return <main className="w-full max-w-[1240px] px-[22px] pt-[26px] pb-[60px]">{children}</main>;

  const { userId, email, name, avatarUrl } = identity;
  return (
    <ArchiveShell accountCenterUrl={accountCenterUrl()} folders={getArchiveService().listFolders(userId)} user={{ userId, email, name, avatarUrl, membership: null }}>
      {children}
    </ArchiveShell>
  );
}
