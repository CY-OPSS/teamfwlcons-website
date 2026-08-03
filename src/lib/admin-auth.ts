const REPO = "CY-OPSS/teamfwlcons-website";

export async function verifyGithubAdmin(token: string | null) {
  if (!token) return false;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
