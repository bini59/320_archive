// 321_auth 탈퇴 반영 — 부팅 직후 한 번, 이후 10분마다. auth 장애·미설정은 로그만 남기고 다음 주기에 재시도한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isE2eAuthBypass, syncDeletions } = await import("./lib/auth");
  if (isE2eAuthBypass()) return;
  const { getArchiveService } = await import("./lib/archive/service");
  const sync = () =>
    syncDeletions((userId) => getArchiveService().deleteUser(userId)).catch((error) =>
      console.error("deletion sync failed:", error),
    );
  void sync();
  setInterval(sync, 10 * 60_000).unref();
}
