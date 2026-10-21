import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedSession: vi.fn(),
  retry: vi.fn(),
  isArchiveAdmin: vi.fn(),
  updateTags: vi.fn(),
  deleteArchive: vi.fn(),
  redirect: vi.fn(),
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
  getArchiveService: () => ({ retry: mocks.retry, updateTags: mocks.updateTags, deleteArchive: mocks.deleteArchive }),
}));
vi.mock("@/lib/admin", () => ({ isArchiveAdmin: mocks.isArchiveAdmin, startAdminSession: vi.fn(), endAdminSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { deleteArchiveAction, retryArchiveAction, updateArchiveTagsAction } from "./actions";
import { TagValidationError } from "@/lib/archive/tags";
import { initialArchiveAdminState } from "./archive-admin-state";

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
describe("archive admin actions", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };

  it("rejects tag edits and deletions without admin rights", async () => {
    mocks.isArchiveAdmin.mockResolvedValue(false);
    await expect(updateArchiveTagsAction(initialArchiveAdminState, form({ archiveId: id, tags: "a" }))).resolves.toMatchObject({ kind: "forbidden" });
    await expect(deleteArchiveAction(initialArchiveAdminState, form({ archiveId: id, confirm: "delete" }))).resolves.toMatchObject({ kind: "forbidden" });
    expect(mocks.updateTags).not.toHaveBeenCalled();
    expect(mocks.deleteArchive).not.toHaveBeenCalled();
  });

  it("reports tag validation errors and saves valid tags", async () => {
    mocks.isArchiveAdmin.mockResolvedValue(true);
    mocks.updateTags.mockImplementationOnce(() => { throw new TagValidationError("태그는 최대 10개까지 입력할 수 있습니다."); });
    await expect(updateArchiveTagsAction(initialArchiveAdminState, form({ archiveId: id, tags: "x" }))).resolves.toEqual({ kind: "validation", message: "태그는 최대 10개까지 입력할 수 있습니다." });
    mocks.updateTags.mockReturnValueOnce({ id, tags: [] });
    await expect(updateArchiveTagsAction(initialArchiveAdminState, form({ archiveId: id, tags: "news" }))).resolves.toMatchObject({ kind: "success" });
    expect(mocks.updateTags).toHaveBeenLastCalledWith(id, "news");
  });

  it("requires explicit confirmation before deleting and reports partial failures", async () => {
    mocks.isArchiveAdmin.mockResolvedValue(true);
    mocks.deleteArchive.mockReset();
    await expect(deleteArchiveAction(initialArchiveAdminState, form({ archiveId: id }))).resolves.toMatchObject({ kind: "validation" });
    expect(mocks.deleteArchive).not.toHaveBeenCalled();

    mocks.deleteArchive.mockResolvedValueOnce("files_pending");
    await expect(deleteArchiveAction(initialArchiveAdminState, form({ archiveId: id, confirm: "delete" }))).resolves.toMatchObject({ kind: "partial" });
    mocks.deleteArchive.mockResolvedValueOnce("not_found");
    await expect(deleteArchiveAction(initialArchiveAdminState, form({ archiveId: id, confirm: "delete" }))).resolves.toMatchObject({ kind: "not_found" });
    mocks.deleteArchive.mockResolvedValueOnce("deleted");
    await deleteArchiveAction(initialArchiveAdminState, form({ archiveId: id, confirm: "delete" }));
    expect(mocks.redirect).toHaveBeenLastCalledWith("/archives?deleted=1");
  });
});
