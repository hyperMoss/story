import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "crossroads_demo_access";

function configuredCode() {
  return process.env.DEMO_ACCESS_CODE?.trim() ?? "";
}

function tokenFor(code: string) {
  return createHash("sha256").update(`crossroads:${code}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function accessIsRequired() {
  return configuredCode().length > 0;
}

export async function isAuthorized() {
  const code = configuredCode();
  if (!code) return true;
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value === tokenFor(code);
}

export function accessCodeMatches(candidate: string) {
  const code = configuredCode();
  return !code || safeEqual(candidate, code);
}

export async function grantAccess() {
  const code = configuredCode();
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, tokenFor(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
