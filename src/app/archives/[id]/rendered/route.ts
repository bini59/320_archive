import { connection } from "next/server";
import { verifySession } from "@/lib/auth";

import { getArchiveService } from "@/lib/archive/service";
import { SnapshotContentNotFoundError } from "@/lib/archive/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Disposition": "inline",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; frame-src 'none'; child-src 'none'; script-src 'none'; style-src 'self'; connect-src 'none'; media-src 'none'; font-src 'self'; object-src 'none'; worker-src 'none'; manifest-src 'none'; sandbox",
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function unavailable(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return unavailable();

  await connection();
  try {
    const sid = request.headers.get("cookie")?.match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
    const identity = await verifySession(sid);
    const ownerId = identity?.membership?.status === "active" ? identity.userId : undefined;
    const service = getArchiveService();
    const result = ownerId
      ? (await service.findOwnedContent(ownerId, id, "rendered")) ?? (await service.findPublicContent(id, "rendered"))
      : await service.findPublicContent(id, "rendered");
    if (!result) return unavailable();
    return new Response(new Blob([new Uint8Array(result.content.bytes)], { type: "text/html; charset=utf-8" }), { headers: CONTENT_HEADERS });
  } catch (error) {
    if (error instanceof SnapshotContentNotFoundError) return unavailable();
    throw error;
  }
}
