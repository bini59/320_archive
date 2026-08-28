import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedSession: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedSession: mocks.requireAuthenticatedSession,
  AuthUnavailableError: class AuthUnavailableError extends Error {},
  isE2eAuthBypass: vi.fn(),
  loginUrl: vi.fn(),
  currentAppOrigin: vi.fn(),
  revokeSession: vi.fn(),
}));
vi.mock("@/lib/archive/service", () => ({
  getArchiveService: () => ({ retry: mocks.retry }),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { retryArchiveAction } from "./actions";

const state = { error: null };

describe("retryArchiveAction", () => {
  it("passes the authenticated owner to the retry service", async () => {
    mocks.requireAuthenticatedSession.mockResolvedValue({ userId: "owner-1" });
    mocks.retry.mockResolvedValue({ archive: { id: "archive-1", status: "pending" }, started: true });
    const data = new FormData();
    data.set("archiveId", "archive-1");

    await expect(retryArchiveAction(state, data)).resolves.toEqual({ error: "이미 캡처 중입니다. 잠시 후 새로고침해 주세요." });
    expect(mocks.retry).toHaveBeenCalledWith("owner-1", "archive-1");
  });

  it("does not disclose an archive when the service cannot find it for the owner", async () => {
    mocks.requireAuthenticatedSession.mockResolvedValue({ userId: "other-user" });
    mocks.retry.mockResolvedValue(null);
    const data = new FormData();
    data.set("archiveId", "private-archive");

    await expect(retryArchiveAction(state, data)).resolves.toEqual({ error: "아카이브를 찾을 수 없습니다." });
    expect(mocks.retry).toHaveBeenCalledWith("other-user", "private-archive");
  });
});
