import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const SECRET = "correct-horse-battery-staple";

async function load() {
  vi.resetModules();
  return import("./admin");
}

beforeEach(() => { vi.stubEnv("ARCHIVE_ADMIN_SECRET", SECRET); jar.set.mockReset(); jar.get.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("admin authorization boundary", () => {
  it("is disabled when the secret is missing or too short", async () => {
    vi.stubEnv("ARCHIVE_ADMIN_SECRET", "short");
    const admin = await load();
    expect(admin.isAdminConfigured()).toBe(false);
    expect(admin.verifyAdminSecret("short")).toBe(false);
    expect(admin.createAdminToken()).toBeNull();
    await expect(admin.startAdminSession("short")).resolves.toBe("unconfigured");
  });

  it("accepts only valid, unexpired tokens signed with the current secret", async () => {
    const admin = await load();
    const now = 1_000_000;
    const token = admin.createAdminToken(now)!;
    expect(token).not.toContain(SECRET);
    expect(admin.verifyAdminToken(token, now + 1)).toBe(true);
    expect(admin.verifyAdminToken(undefined, now)).toBe(false);
    expect(admin.verifyAdminToken(`${token}x`, now)).toBe(false);
    expect(admin.verifyAdminToken(token.replace(/^\d+/, String(now + 10 ** 9)), now)).toBe(false);
    expect(admin.verifyAdminToken(token, now + 13 * 60 * 60 * 1000)).toBe(false);
    vi.stubEnv("ARCHIVE_ADMIN_SECRET", "another-long-admin-secret");
    expect(admin.verifyAdminToken(token, now + 1)).toBe(false);
  });

  it("checks the request cookie", async () => {
    const admin = await load();
    jar.get.mockReturnValue(undefined);
    expect(await admin.isArchiveAdmin()).toBe(false);
    await expect(admin.requireArchiveAdmin()).rejects.toBeInstanceOf(admin.AdminAuthorizationError);
    jar.get.mockReturnValue({ value: admin.createAdminToken() });
    expect(await admin.isArchiveAdmin()).toBe(true);
  });

  it("sets an httpOnly session cookie on success and locks out repeated failures", async () => {
    const admin = await load();
    await expect(admin.startAdminSession(SECRET)).resolves.toBe("ok");
    expect(jar.set).toHaveBeenCalledWith(admin.ADMIN_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }));
    expect(jar.set.mock.calls[0][1]).not.toContain(SECRET);

    for (let i = 0; i < 10; i++) await expect(admin.startAdminSession("wrong")).resolves.toBe("invalid");
    await expect(admin.startAdminSession(SECRET)).resolves.toBe("locked");
    await expect(admin.startAdminSession(SECRET, Date.now() + 16 * 60 * 1000)).resolves.toBe("ok");
  });
});
