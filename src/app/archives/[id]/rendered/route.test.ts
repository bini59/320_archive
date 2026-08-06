import { beforeEach, describe, expect, it, vi } from "vitest";

const findContent = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/archive/service", () => ({ getArchiveService: () => ({ findContent }) }));

const ID = "123e4567-e89b-42d3-a456-426614174000";

async function request(id = ID) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/archives/${id}/rendered`), { params: Promise.resolve({ id }) });
}

describe("GET /archives/[id]/rendered", () => {
  beforeEach(() => findContent.mockReset());

  it("serves rendered HTML with self-hosted style/font and no-script CSP", async () => {
    findContent.mockResolvedValue({
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
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(findContent).toHaveBeenCalledWith(ID, "rendered");
  });

  it("does not expose a missing legacy rendered snapshot", async () => {
    findContent.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });

  it("rejects invalid IDs before storage lookup", async () => {
    expect((await request("../snapshot.json")).status).toBe(404);
    expect(findContent).not.toHaveBeenCalled();
  });
});
