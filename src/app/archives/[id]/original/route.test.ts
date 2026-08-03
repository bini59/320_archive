import { beforeEach, describe, expect, it, vi } from "vitest";

const findContent = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/archive/service", () => ({
  getArchiveService: () => ({ findContent }),
}));

const VALID_ID = "123e4567-e89b-42d3-a456-426614174000";

async function request(id: string) {
  // This test group is developed in parallel with the route implementation.
  const routeModule = "./route";
  const { GET } = await import(routeModule);
  return GET(new Request(`http://localhost/archives/${encodeURIComponent(id)}/original`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /archives/[id]/original", () => {
  beforeEach(() => findContent.mockReset());

  it("serves original bytes for a saved archive with restrictive browser headers", async () => {
    findContent.mockResolvedValue({
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
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toMatch(/(?:^|;)\s*sandbox(?:;|$)/);
    expect(findContent).toHaveBeenCalledWith(VALID_ID, "original");
  });

  it.each([
    ["missing", null],
    ["failed", null],
    ["pending", null],
  ])("does not expose content for a %s archive", async (_state, result) => {
    findContent.mockResolvedValue(result);
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
    expect(findContent).not.toHaveBeenCalled();
  });
});
