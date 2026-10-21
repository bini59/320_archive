import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// 관리 권한 경계. 지금은 ARCHIVE_ADMIN_SECRET 으로 발급한 서명 쿠키로 판단한다.
// SSO 로 바꿀 때는 이 모듈의 isArchiveAdmin/requireArchiveAdmin 구현만 교체하면 된다.

export const ADMIN_COOKIE = "archive_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 16;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export class AdminAuthorizationError extends Error {
  constructor() {
    super("관리 권한이 필요합니다.");
    this.name = "AdminAuthorizationError";
  }
}

function adminSecret(): string | null {
  const secret = process.env.ARCHIVE_ADMIN_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function isAdminConfigured(): boolean {
  return adminSecret() !== null;
}

const digest = (value: string) => createHash("sha256").update(value).digest();
const sign = (secret: string, expires: number) => createHmac("sha256", secret).update(`archive-admin:${expires}`).digest("base64url");

function sameBytes(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminSecret(input: unknown): boolean {
  const secret = adminSecret();
  return secret !== null && typeof input === "string" && sameBytes(digest(input), digest(secret));
}

export function createAdminToken(now = Date.now()): string | null {
  const secret = adminSecret();
  if (!secret) return null;
  const expires = now + SESSION_TTL_MS;
  return `${expires}.${sign(secret, expires)}`;
}

// 서명에 비밀키가 들어가므로 비밀키를 바꾸면 기존 관리 세션은 모두 무효가 된다.
export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const [expiresText, signature, extra] = token.split(".");
  const expires = Number(expiresText);
  if (extra !== undefined || !signature || !Number.isSafeInteger(expires) || expires <= now) return false;
  return sameBytes(Buffer.from(signature), Buffer.from(sign(secret, expires)));
}

export async function isArchiveAdmin(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function requireArchiveAdmin(): Promise<void> {
  if (!(await isArchiveAdmin())) throw new AdminAuthorizationError();
}

// 비밀키 추측을 늦추기 위한 프로세스 단위 실패 제한.
const failures: number[] = [];

export type AdminSignInResult = "ok" | "invalid" | "locked" | "unconfigured";

export async function startAdminSession(input: unknown, now = Date.now()): Promise<AdminSignInResult> {
  if (!isAdminConfigured()) return "unconfigured";
  while (failures.length && failures[0] <= now - FAILURE_WINDOW_MS) failures.shift();
  if (failures.length >= MAX_FAILURES) return "locked";
  if (!verifyAdminSecret(input)) {
    failures.push(now);
    return "invalid";
  }
  (await cookies()).set(ADMIN_COOKIE, createAdminToken(now)!, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return "ok";
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
}
