import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AuthConfigurationError,
  AuthUnavailableError,
  isE2eAuthBypass,
  loginUrl,
  verifySession,
} from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (isE2eAuthBypass()) return NextResponse.next();

  const sid = request.cookies.get("sid")?.value;
  try {
    const identity = await verifySession(sid);
    if (identity?.membership?.status === "active") return NextResponse.next();

    const appOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const response = NextResponse.redirect(loginUrl(`${appOrigin}/`));
    if (sid) response.cookies.delete({ name: "sid", path: "/" });
    return response;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json({ error: "archive auth is not configured" }, { status: 503 });
    }
    if (error instanceof AuthUnavailableError) {
      return NextResponse.json({ error: "authentication service unavailable" }, { status: 503 });
    }
    throw error;
  }
}

export const config = { matcher: ["/"] };
