import { beforeEach, describe, expect, it, vi } from "vitest";

const findPublicContent = vi.fn();
const findOwnedContent = vi.fn();
const verifySession = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ verifySession }));
vi.mock("@/lib/archive/service", () => ({ getArchiveService: () => ({ findPublicContent, findOwnedContent }) }));

const ID = "123e4567-e89b-42d3-a456-426614174000";

async function request(id = ID, sid?: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/archives/${id}/rendered`, { headers: sid ? { cookie: `sid=${sid}` } : undefined }), { params: Promise.resolve({ id }) });
}

describe("GET /archives/[id]/rendered", () => {
  beforeEach(() => {
    findPublicContent.mockReset();
    findOwnedContent.mockReset();
    verifySession.mockReset();
  });

  it("passes the active session owner to private content lookup", async () => {
    verifySession.mockResolvedValue({ userId: "owner-1", membership: { status: "active" } });
    findOwnedContent.mockResolvedValue({ archive: { id: ID, status: "saved", snapshot: {} }, content: { kind: "rendered", bytes: Buffer.from("private") } });

    expect(await (await request(ID, "session-1")).text()).toBe("private");
    expect(findOwnedContent).toHaveBeenCalledWith("owner-1", ID, "rendered");
  });

  it("serves rendered HTML with self-hosted style/font and no-script CSP", async () => {
    findPublicContent.mockResolvedValue({
      archive: { id: ID, status: "saved", snapshot: {} },
      content: { kind: "rendered", bytes: Buffer.from("<html>hydrated</html>") },
    });

    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>hydrated</html>");
    expect(response.headers.get("content-security-policy")).toContain("style-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("font-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("sandbox allow-same-origin");
    expect(findPublicContent).toHaveBeenCalledWith(ID, "rendered");
  });

  it("does not expose a missing legacy rendered snapshot", async () => {
    findPublicContent.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });

  it("rejects invalid IDs before storage lookup", async () => {
    expect((await request("../snapshot.json")).status).toBe(404);
    expect(findPublicContent).not.toHaveBeenCalled();
  });
});
