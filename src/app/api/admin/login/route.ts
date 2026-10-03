import { NextResponse } from "next/server";
import { verifyGithubAdmin } from "@/lib/admin-auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const identity = await verifyGithubAdmin(token);
    if (!identity) {
      return NextResponse.json({ error: "无权登录后台" }, { status: 401 });
    }

    const session = await createSessionToken({
      userId: `github:${identity.login}`,
      username: identity.login,
      role: "ADMIN",
    });
    const response = NextResponse.json({ login: identity.login });
    setSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error("Admin login error", error);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
