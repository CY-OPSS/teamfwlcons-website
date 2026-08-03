import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBearerToken, verifyGithubAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!(await verifyGithubAdmin(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const postSlug = searchParams.get("postSlug") || undefined;

    const comments = await prisma.comment.findMany({
      where: postSlug ? { postSlug } : undefined,
      include: {
        user: {
          select: { username: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Admin list comments error:", error);
    return NextResponse.json(
      { error: "Failed to list comments" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const token = getBearerToken(request);
  if (!(await verifyGithubAdmin(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing comment id" }, { status: 400 });
    }

    await prisma.comment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin delete comment error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
