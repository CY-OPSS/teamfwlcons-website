import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "tf_session";
const SESSION_DAYS = 30;

export type SessionPayload = {
  userId: string;
  username: string;
  role: string;
};

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";
const MIN_SECRET_LENGTH = 32;

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    // Fail closed. The fallback below is a public constant, so signing with it
    // in production would let anyone mint a token carrying role: "ADMIN".
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET (or NEXTAUTH_SECRET) is not set. Refusing to sign or verify sessions."
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  if (
    process.env.NODE_ENV === "production" &&
    secret.length < MIN_SECRET_LENGTH
  ) {
    throw new Error(
      `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      role: typeof payload.role === "string" ? payload.role : "VISITOR",
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function cookieSecure() {
  // HTTP origins cannot keep Secure cookies; follow NEXTAUTH_URL unless overridden.
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const publicUrl = process.env.NEXTAUTH_URL || "";
  if (publicUrl.startsWith("https://")) return true;
  if (publicUrl.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
