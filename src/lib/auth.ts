import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getArchiveService } from "@/lib/archive/service";

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

// Only AUTH_ORIGIN matters for the account centre link, so this stays usable
// under the E2E bypass where the client credentials are deliberately absent.
export function accountCenterUrl() {
  const authOrigin = process.env.AUTH_ORIGIN?.replace(/\/$/, "");
  if (!authOrigin) {
    if (isE2eAuthBypass()) return "https://auth.bini59.dev/client";
    throw new AuthConfigurationError("AUTH_ORIGIN is required");
  }
  return new URL("/client", authOrigin).toString();
}

// 321_auth guards POST /logout with a double-submit csrf token and clears the
// csrf cookie after each login callback, so a browser-side form cannot rely on
// having one. Calling it server to server lets us issue the matched pair and
// still revoke the shared sid session in Redis.
export async function revokeSession(sid: string): Promise<void> {
  const { authOrigin, clientId } = config();
  const csrf = randomBytes(16).toString("base64url");
  const url = new URL("/logout", authOrigin);
  url.searchParams.set("client_id", clientId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { cookie: `sid=${sid}; csrf=${csrf}`, "x-csrf-token": csrf },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    // 302 is the success path; auth redirects back to the client after revoking.
    if (response.status !== 302 && !response.ok) {
      throw new AuthUnavailableError(`auth logout failed (${response.status})`);
    }
  } catch (error) {
    if (error instanceof AuthUnavailableError) throw error;
    throw new AuthUnavailableError("auth logout unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifySession(sid: string | undefined): Promise<AuthenticatedIdentity | null> {
  if (isE2eAuthBypass()) {
    const identity = { userId: "e2e", email: null, name: "E2E", avatarUrl: null, membership: { role: "member", status: "active" } };
    getArchiveService().syncUser(identity);
    return identity;
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
    const identity = (await response.json()) as AuthenticatedIdentity;
    if (!identity.userId || !identity.membership) throw new AuthUnavailableError("invalid auth response");
    getArchiveService().syncUser(identity);
    return identity;
  } catch (error) {
    if (error instanceof AuthUnavailableError || error instanceof AuthConfigurationError) throw error;
    throw new AuthUnavailableError("auth verify unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function currentAppOrigin() {
  const configured = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new AuthUnavailableError("request host is unavailable");
  return `${protocol}://${host}`;
}

export async function requireAuthenticatedSession() {
  const sid = (await cookies()).get("sid")?.value;
  const identity = await verifySession(sid);
  if (!identity || identity.membership?.status !== "active") {
    redirect(loginUrl(`${await currentAppOrigin()}/`).toString());
  }
  return identity;
}
