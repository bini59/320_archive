import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { AuthConfigurationError, AuthUnavailableError, accountCenterUrl, revokeSession } =
  await import("./auth");

describe("accountCenterUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("points at the auth account centre without requiring client credentials", () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.example.test");
    expect(accountCenterUrl()).toBe("https://auth.example.test/client");
  });

  it("tolerates a trailing slash on the configured origin", () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.example.test/");
    expect(accountCenterUrl()).toBe("https://auth.example.test/client");
  });

  it("rejects a missing origin outside the E2E bypass", () => {
    vi.stubEnv("AUTH_ORIGIN", "");
    vi.stubEnv("ARCHIVE_E2E", "");
    expect(() => accountCenterUrl()).toThrow(AuthConfigurationError);
  });
});

describe("revokeSession", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AUTH_ORIGIN", "https://auth.example.test");
    vi.stubEnv("CLIENT_ID", "archive");
    vi.stubEnv("APP_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("revokes the shared session with a matched double-submit csrf pair", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302 }));

    await expect(revokeSession("session-value")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).origin).toBe("https://auth.example.test");
    expect(new URL(url).pathname).toBe("/logout");
    expect(new URL(url).searchParams.get("client_id")).toBe("archive");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");

    const headers = init.headers as Record<string, string>;
    const csrfCookie = /csrf=([^;]+)/.exec(headers.cookie)?.[1];
    expect(headers.cookie).toContain("sid=session-value");
    expect(csrfCookie).toBeTruthy();
    expect(headers["x-csrf-token"]).toBe(csrfCookie);
  });

  it("never forwards the app secret to the browser-facing logout route", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302 }));
    await revokeSession("session-value");
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("test-secret");
  });

  it("reports auth rejections as unavailability instead of leaking the status body", async () => {
    fetchMock.mockResolvedValue(new Response("csrf token mismatch", { status: 403 }));
    await expect(revokeSession("session-value")).rejects.toThrow(AuthUnavailableError);
  });

  it("reports a transport failure as unavailability", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    await expect(revokeSession("session-value")).rejects.toThrow(AuthUnavailableError);
  });
});
