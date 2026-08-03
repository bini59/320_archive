import { checkArchiveReadiness } from "@/lib/archive/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkArchiveReadiness();
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
