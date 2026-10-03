import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const GITHUB_API = "https://api.github.com";
const DEFAULT_REPO = "CY-OPSS/teamfwlcons-website";

export type AdminIdentity = { login: string };

function repoSlug() {
  return process.env.ADMIN_REPO || DEFAULT_REPO;
}

/**
 * Optional comma-separated allowlist of GitHub logins (ADMIN_GITHUB_USERS).
 * When unset, any login that has *write* access to the repo is accepted.
 */
function allowedLogins(): string[] {
  return (process.env.ADMIN_GITHUB_USERS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function github(path: string, token: string) {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

/**
 * A token only proves admin rights if it can *write* to the repo and, when
 * ADMIN_GITHUB_USERS is configured, belongs to one of the listed accounts.
 *
 * Merely being able to read the repo must not be enough: a read-only token
 * would otherwise unlock comment deletion and the statistics endpoint.
 */
export async function verifyGithubAdmin(
  token: string | null
): Promise<AdminIdentity | null> {
  if (!token) return null;
  const clean = token.trim();
  if (clean.length < 20) return null;

  try {
    const repoRes = await github(`/repos/${repoSlug()}`, clean);
    if (!repoRes.ok) return null;
    const repo = await repoRes.json();
    if (repo?.permissions?.push !== true) return null;

    const userRes = await github("/user", clean);
    if (!userRes.ok) return null;
    const user = await userRes.json();
    const login =
      typeof user?.login === "string" ? user.login.toLowerCase() : "";
    if (!login) return null;

    const allow = allowedLogins();
    if (allow.length > 0 && !allow.includes(login)) return null;

    return { login };
  } catch {
    return null;
  }
}

export type AdminSession = { login: string };

/**
 * Cookie session for the admin panel. GitHub PATs are only accepted at login;
 * later requests must carry role ADMIN. Database users are re-checked so a
 * demotion takes effect before the JWT expires.
 */
export async function requireAdminSession(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;

  if (session.userId.startsWith("github:")) {
    const login = session.userId.slice("github:".length);
    if (!login) return null;
    const allow = allowedLogins();
    if (allow.length > 0 && !allow.includes(login.toLowerCase())) return null;
    return { login };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, username: true },
    });
    if (!user || user.role !== "ADMIN") return null;
    return { login: user.username };
  } catch (error) {
    console.error("Admin session lookup failed", error);
    return null;
  }
}
