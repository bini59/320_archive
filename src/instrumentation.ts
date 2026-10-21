// 321_auth 탈퇴 반영 — 부팅 직후 한 번, 이후 10분마다. auth 장애·미설정은 로그만 남기고 다음 주기에 재시도한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // 관리자 삭제 후 정리하지 못한 스냅샷 파일을 다시 지운다.
  const { getArchiveService: archiveService } = await import("./lib/archive/service");
  const cleanup = () =>
    archiveService().retryPendingFileCleanups().catch((error) =>
      console.error("archive file cleanup failed:", error instanceof Error ? error.message : "unknown error"),
    );
  void cleanup();
  setInterval(cleanup, 10 * 60_000).unref();

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
