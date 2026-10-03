import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

/**
 * Proxies the Vercel deploy hook so the hook URL (which carries its own
 * bearer token) never reaches the browser bundle.
 */
export async function POST() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    return NextResponse.json(
      { error: "VERCEL_DEPLOY_HOOK is not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(hook, { method: "POST" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Deploy hook responded ${res.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Deploy hook request failed" },
      { status: 502 }
    );
  }
}
