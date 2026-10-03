import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_IP_ATTEMPTS = 30;

export function clientIp(request: Request) {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

export function attemptKey(request: Request, username: string) {
  return `${clientIp(request)}:${username.slice(0, 64).toLowerCase()}`;
}

function ipKey(request: Request) {
  return `${clientIp(request)}:*`;
}

async function maybePurge() {
  if (Math.random() > 1 / 50) return;
  await prisma.authAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

export async function tooManyAttempts(request: Request, username: string) {
  await maybePurge();
  const since = new Date(Date.now() - WINDOW_MS);
  const [userCount, ipCount] = await Promise.all([
    prisma.authAttempt.count({
      where: { key: attemptKey(request, username), createdAt: { gte: since } },
    }),
    prisma.authAttempt.count({
      where: { key: ipKey(request), createdAt: { gte: since } },
    }),
  ]);
  return userCount >= MAX_ATTEMPTS || ipCount >= MAX_IP_ATTEMPTS;
}

export async function recordAttempt(request: Request, username: string) {
  await prisma.authAttempt.createMany({
    data: [
      { key: attemptKey(request, username) },
      { key: ipKey(request) },
    ],
  });
}
