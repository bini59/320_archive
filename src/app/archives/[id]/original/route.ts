import { connection } from "next/server";
import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError } from "@/lib/archive/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Disposition": "inline",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox",
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function unavailable(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return unavailable();

  await connection();
  try {
    // findContent re-authorizes against current DB state before resolving the fixed original content kind.
    const result = await getArchiveService().findContent(id, "original");
    if (!result) return unavailable();
    const body = new Blob([new Uint8Array(result.content.bytes)], { type: "text/html; charset=utf-8" });
    return new Response(body, { headers: CONTENT_HEADERS });
  } catch (error) {
    if (error instanceof SnapshotContentNotFoundError) return unavailable();
    throw error;
  }
}
