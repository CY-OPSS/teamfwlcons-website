import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ login: admin.login });
}
