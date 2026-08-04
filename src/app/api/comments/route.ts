import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const userSelect = {
  id: true,
  username: true,
  name: true,
  image: true,
} as const;

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
        parentId: null,
      },
      include: {
        user: { select: userSelect },
        replies: {
          where: { approved: true },
          include: {
            user: { select: userSelect },
          },
          orderBy: { createdAt: "asc" },
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

    const { content, postSlug, locale, parentId } = await request.json();
    const text = typeof content === "string" ? content.trim() : "";
    const post = typeof postSlug === "string" ? postSlug : "";
    const loc = typeof locale === "string" && locale ? locale : "zh";
    const replyTo =
      typeof parentId === "string" && parentId.trim() ? parentId.trim() : null;

    if (!text || !post) {
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

    let rootParentId: string | null = null;
    let notifyUserId: string | null = null;
    if (replyTo) {
      const parent = await prisma.comment.findUnique({
        where: { id: replyTo },
        select: {
          id: true,
          postSlug: true,
          locale: true,
          parentId: true,
          approved: true,
          userId: true,
        },
      });

      if (!parent || !parent.approved) {
        return NextResponse.json(
          { error: "回复的评论不存在" },
          { status: 404 }
        );
      }

      if (parent.postSlug !== post || parent.locale !== loc) {
        return NextResponse.json(
          { error: "无法回复其他文章的评论" },
          { status: 400 }
        );
      }

      // Keep one nesting level: replies always attach to the top-level comment
      rootParentId = parent.parentId ?? parent.id;
      if (parent.userId !== session.userId) {
        notifyUserId = parent.userId;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: text,
        postSlug: post,
        locale: loc,
        userId: session.userId,
        parentId: rootParentId,
        approved: true,
      },
      include: {
        user: { select: userSelect },
        replies: {
          where: { approved: true },
          include: {
            user: { select: userSelect },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (notifyUserId) {
      const preview =
        text.length > 120 ? `${text.slice(0, 120)}…` : text;
      await prisma.notification.create({
        data: {
          type: "comment_reply",
          userId: notifyUserId,
          actorId: session.userId,
          commentId: comment.id,
          postSlug: post,
          locale: loc,
          preview,
        },
      });
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "发表评论失败，请确认数据库已配置" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const id =
      typeof body?.id === "string"
        ? body.id
        : new URL(request.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "缺少评论 id" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!comment) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    }

    const isOwner = comment.userId === session.userId;
    const isAdmin = session.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "只能删除自己的评论" },
        { status: 403 }
      );
    }

    await prisma.comment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { error: "删除评论失败" },
      { status: 500 }
    );
  }
}
