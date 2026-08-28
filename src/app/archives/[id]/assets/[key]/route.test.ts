import { beforeEach, describe, expect, it, vi } from "vitest";

import { SnapshotContentNotFoundError, type AssetKey } from "@/lib/archive/types";

const findPublicAsset = vi.fn();
const findOwnedAsset = vi.fn();
const verifySession = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ verifySession }));
vi.mock("@/lib/archive/service", () => ({ getArchiveService: () => ({ findPublicAsset, findOwnedAsset }) }));

const ID = "123e4567-e89b-42d3-a456-426614174000";
const PNG_KEY = `${"a".repeat(64)}.png` as AssetKey;
const PDF_KEY = `${"b".repeat(64)}.pdf` as AssetKey;
const CSS_KEY = `${"c".repeat(64)}.css` as AssetKey;

async function request(id = ID, key: string = PNG_KEY, sid?: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/archives/${id}/assets/${key}`, { headers: sid ? { cookie: `sid=${sid}` } : undefined }), { params: Promise.resolve({ id, key }) });
}

describe("GET /archives/[id]/assets/[key]", () => {
  beforeEach(() => {
    findPublicAsset.mockReset();
    findOwnedAsset.mockReset();
    verifySession.mockReset();
  });

  it.each([["invalid", PNG_KEY], [ID, "../snapshot.json"], [ID, `${"a".repeat(64)}.html`]])("rejects invalid id/key before lookup", async (id, key) => {
    expect((await request(id, key)).status).toBe(404);
    expect(findPublicAsset).not.toHaveBeenCalled();
  });

  it("returns 404 for private assets without a session", async () => {
    findPublicAsset.mockResolvedValue(null);

    expect((await request()).status).toBe(404);
    expect(findOwnedAsset).not.toHaveBeenCalled();
  });

  it("serves public assets to an authenticated user", async () => {
    verifySession.mockResolvedValue({ userId: "reader-1", membership: { status: "active" } });
    findOwnedAsset.mockResolvedValue(null);
    findPublicAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: PNG_KEY, mimeType: "image/png", byteLength: 3 }, bytes: Buffer.from([1, 2, 3]) } });

    expect((await request(ID, PNG_KEY, "session-1")).status).toBe(200);
    expect(findOwnedAsset).toHaveBeenCalledWith("reader-1", ID, PNG_KEY);
    expect(findPublicAsset).toHaveBeenCalledWith(ID, PNG_KEY);
  });

  it("does not serve unsaved, missing, or non-member assets", async () => {
    findPublicAsset.mockResolvedValueOnce(null).mockRejectedValueOnce(new SnapshotContentNotFoundError(ID, "original"));
    expect((await request()).status).toBe(404);
    expect((await request()).status).toBe(404);
  });

  it("serves an image inline with stored metadata", async () => {
    findPublicAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: PNG_KEY, mimeType: "image/png", byteLength: 3 }, bytes: Buffer.from([1, 2, 3]) } });
    const response = await request();
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("3");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("forces attachments to a server-selected ASCII filename", async () => {
    findPublicAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: PDF_KEY, mimeType: "application/pdf", byteLength: 2 }, bytes: Buffer.from("ok") } });
    const response = await request(ID, PDF_KEY);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="archived-asset.pdf"');
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(findPublicAsset).toHaveBeenCalledWith(ID, PDF_KEY);
  });

  it("serves self-hosted CSS inline for the rendered viewer", async () => {
    findPublicAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: CSS_KEY, mimeType: "text/css", byteLength: 15 }, bytes: Buffer.from("body{color:red}") } });
    const response = await request(ID, CSS_KEY);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(await response.text()).toBe("body{color:red}");
  });
});
