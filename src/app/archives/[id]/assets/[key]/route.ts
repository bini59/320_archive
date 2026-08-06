import { connection } from "next/server";

import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError } from "@/lib/archive/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_KEY_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|gif|webp|avif|pdf|txt|css|woff|woff2|ttf|otf|eot)$/;

function unavailable(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!UUID_PATTERN.test(id) || !ASSET_KEY_PATTERN.test(key)) return unavailable();

  await connection();
  try {
    const result = await getArchiveService().findAsset(id, key);
    if (!result) return unavailable();

    const { asset, bytes } = result.stored;
    const attachment = asset.mimeType === "application/pdf" || asset.mimeType === "text/plain";
    const extension = asset.mimeType === "application/pdf" ? "pdf" : "txt";
    return new Response(new Blob([new Uint8Array(bytes)]), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.byteLength),
        "Content-Disposition": attachment ? `attachment; filename="archived-asset.${extension}"` : "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SnapshotContentNotFoundError) return unavailable();
    throw error;
  }
}
