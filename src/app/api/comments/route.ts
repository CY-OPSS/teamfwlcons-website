import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postSlug = searchParams.get("postSlug");
    const locale = searchParams.get("locale") || "zh";

    if (!postSlug) {
      return NextResponse.json(
        { error: "Missing postSlug" },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        postSlug,
        locale,
        approved: true,
      },
      include: {
        user: {
          select: { username: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Failed to get comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "请先登录后再评论" },
        { status: 401 }
      );
    }

    const { content, postSlug, locale } = await request.json();
    const text = typeof content === "string" ? content.trim() : "";

    if (!text || !postSlug) {
      return NextResponse.json(
        { error: "评论内容不能为空" },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: "评论过长（最多2000字）" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content: text,
        postSlug,
        locale: locale || "zh",
        userId: session.userId,
        approved: true,
      },
      include: {
        user: {
          select: { username: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "发表评论失败，请确认数据库已配置" },
      { status: 500 }
    );
  }
}
