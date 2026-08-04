import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.userId },
        include: {
          actor: {
            select: { id: true, username: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId: session.userId, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "加载消息失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : null;
    const markAll = body?.all === true;

    if (!markAll && (!ids || ids.length === 0)) {
      return NextResponse.json(
        { error: "缺少要标记的消息" },
        { status: 400 }
      );
    }

    await prisma.notification.updateMany({
      where: markAll
        ? { userId: session.userId, read: false }
        : { userId: session.userId, id: { in: ids! } },
      data: { read: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.userId, read: false },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { error: "标记已读失败" },
      { status: 500 }
    );
  }
}
