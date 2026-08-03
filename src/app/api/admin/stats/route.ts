import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBearerToken, verifyGithubAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!(await verifyGithubAdmin(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [commentCount, userCount, views] = await Promise.all([
      prisma.comment.count(),
      prisma.user.count(),
      prisma.viewStat.findMany({
        orderBy: { views: "desc" },
        take: 20,
      }),
    ]);

    const totalViews = views.reduce((sum, item) => sum + item.views, 0);

    return NextResponse.json({
      commentCount,
      userCount,
      totalViews,
      topPages: views,
      analyticsUrl:
        "https://vercel.com/facwink/teamfwlcons-website/analytics",
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
