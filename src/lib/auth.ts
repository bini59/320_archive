import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export interface AuthenticatedIdentity {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  membership: { role: string; status: string } | null;
}

export class AuthUnavailableError extends Error {}
export class AuthConfigurationError extends Error {}

function config() {
  const authOrigin = process.env.AUTH_ORIGIN?.replace(/\/$/, "");
  const clientId = process.env.CLIENT_ID;
  const appSecret = process.env.APP_SECRET;
  if (!authOrigin || !clientId || !appSecret) {
    throw new AuthConfigurationError("AUTH_ORIGIN, CLIENT_ID, and APP_SECRET are required");
  }
  return { authOrigin, clientId, appSecret };
}

export function isE2eAuthBypass() {
  return process.env.ARCHIVE_E2E === "1" && process.env.NODE_ENV !== "production";
}

export function loginUrl(returnTo: string) {
  const { authOrigin, clientId } = config();
  const url = new URL("/login", authOrigin);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("return_to", returnTo);
  return url;
}

export async function verifySession(sid: string | undefined): Promise<AuthenticatedIdentity | null> {
  if (isE2eAuthBypass()) {
    return { userId: "e2e", email: null, name: "E2E", avatarUrl: null, membership: { role: "member", status: "active" } };
  }
  const { authOrigin, clientId, appSecret } = config();
  if (!sid) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const url = new URL("/verify", authOrigin);
    url.searchParams.set("client_id", clientId);
    const response = await fetch(url, {
      headers: { cookie: `sid=${sid}`, "x-app-secret": appSecret },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new AuthUnavailableError(`auth verify failed (${response.status})`);
    return (await response.json()) as AuthenticatedIdentity;
  } catch (error) {
    if (error instanceof AuthUnavailableError || error instanceof AuthConfigurationError) throw error;
    throw new AuthUnavailableError("auth verify unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function requireAuthenticatedSession() {
  const sid = (await cookies()).get("sid")?.value;
  const identity = await verifySession(sid);
  if (!identity || identity.membership?.status !== "active") {
    const requestHeaders = await headers();
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    if (!host) throw new AuthUnavailableError("request host is unavailable");
    const appOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "") ?? `${protocol}://${host}`;
    redirect(loginUrl(`${appOrigin}/`).toString());
  }
  return identity;
}
