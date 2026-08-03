import { beforeEach, describe, expect, it, vi } from "vitest";

import { SnapshotContentNotFoundError, type AssetKey } from "@/lib/archive/types";

const findAsset = vi.fn();
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/archive/service", () => ({ getArchiveService: () => ({ findAsset }) }));

const ID = "123e4567-e89b-42d3-a456-426614174000";
const PNG_KEY = `${"a".repeat(64)}.png` as AssetKey;
const PDF_KEY = `${"b".repeat(64)}.pdf` as AssetKey;

async function request(id = ID, key: string = PNG_KEY) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/archives/${id}/assets/${key}`), { params: Promise.resolve({ id, key }) });
}

describe("GET /archives/[id]/assets/[key]", () => {
  beforeEach(() => findAsset.mockReset());

  it.each([["invalid", PNG_KEY], [ID, "../snapshot.json"], [ID, `${"a".repeat(64)}.html`]])("rejects invalid id/key before lookup", async (id, key) => {
    expect((await request(id, key)).status).toBe(404);
    expect(findAsset).not.toHaveBeenCalled();
  });

  it("does not serve unsaved, missing, or non-member assets", async () => {
    findAsset.mockResolvedValueOnce(null).mockRejectedValueOnce(new SnapshotContentNotFoundError(ID, "original"));
    expect((await request()).status).toBe(404);
    expect((await request()).status).toBe(404);
  });

  it("serves an image inline with stored metadata", async () => {
    findAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: PNG_KEY, mimeType: "image/png", byteLength: 3 }, bytes: Buffer.from([1, 2, 3]) } });
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
    findAsset.mockResolvedValue({ archive: { status: "saved" }, stored: { asset: { key: PDF_KEY, mimeType: "application/pdf", byteLength: 2 }, bytes: Buffer.from("ok") } });
    const response = await request(ID, PDF_KEY);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="archived-asset.pdf"');
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(findAsset).toHaveBeenCalledWith(ID, PDF_KEY);
  });
});
