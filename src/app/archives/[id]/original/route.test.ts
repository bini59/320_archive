import { beforeEach, describe, expect, it, vi } from "vitest";

const findPublicContent = vi.fn();
const findOwnedContent = vi.fn();
const verifySession = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ verifySession }));
vi.mock("@/lib/archive/service", () => ({
  getArchiveService: () => ({ findPublicContent, findOwnedContent }),
}));

const VALID_ID = "123e4567-e89b-42d3-a456-426614174000";

async function request(id: string, sid?: string) {
  const routeModule = "./route";
  const { GET } = await import(routeModule);
  return GET(new Request(`http://localhost/archives/${encodeURIComponent(id)}/original`, { headers: sid ? { cookie: `sid=${sid}` } : undefined }), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /archives/[id]/original", () => {
  beforeEach(() => {
    findPublicContent.mockReset();
    findOwnedContent.mockReset();
    verifySession.mockReset();
  });

  it("serves original bytes for a saved archive with restrictive browser headers", async () => {
    findPublicContent.mockResolvedValue({
      archive: { id: VALID_ID, status: "saved", snapshot: {} },
      content: { kind: "original", bytes: Buffer.from("<h1>preserved original</h1>") },
    });

    const response = await request(VALID_ID);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>preserved original</h1>");
    expect(response.headers.get("content-type")).toMatch(/^text\/html(?:;|$)/i);
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toMatch(/(?:no-store|private)/i);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toMatch(/(?:^|;)\s*sandbox allow-same-origin(?:;|$)/);
    expect(findPublicContent).toHaveBeenCalledWith(VALID_ID, "original");
  });

  it("returns 404 for private content without a session", async () => {
    findPublicContent.mockResolvedValue(null);

    const response = await request(VALID_ID);

    expect(response.status).toBe(404);
    expect(findOwnedContent).not.toHaveBeenCalled();
  });

  it("serves public content to an authenticated user", async () => {
    verifySession.mockResolvedValue({ userId: "reader-1", membership: { status: "active" } });
    findOwnedContent.mockResolvedValue(null);
    findPublicContent.mockResolvedValue({
      archive: { id: VALID_ID, status: "saved", snapshot: {} },
      content: { kind: "original", bytes: Buffer.from("public") },
    });

    const response = await request(VALID_ID, "session-1");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("public");
    expect(findOwnedContent).toHaveBeenCalledWith("reader-1", VALID_ID, "original");
    expect(findPublicContent).toHaveBeenCalledWith(VALID_ID, "original");
  });

  it.each([
    ["missing", null],
    ["failed", null],
    ["pending", null],
  ])("does not expose content for a %s archive", async (_state, result) => {
    findPublicContent.mockResolvedValue(result);
    const response = await request(VALID_ID);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("preserved original");
  });

  it.each([
    "not-a-uuid",
    "../snapshot.json",
    `${VALID_ID}/../../snapshot.json`,
    "%2e%2e%2foriginal.html",
  ])("rejects invalid and traversal-like IDs before storage lookup: %s", async (id) => {
    const response = await request(id);
    expect(response.status).toBe(404);
    expect(findPublicContent).not.toHaveBeenCalled();
  });
});
