import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBearerToken, verifyGithubAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!(await verifyGithubAdmin(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [commentCount, userCount, views, aggregates] = await Promise.all([
      prisma.comment.count(),
      prisma.user.count(),
      prisma.viewStat.findMany({
        orderBy: { views: "desc" },
        take: 30,
      }),
      prisma.viewStat.findMany({
        select: { slug: true, views: true },
      }),
    ]);

    let siteViews = 0;
    let postViews = 0;
    for (const item of aggregates) {
      if (item.slug.startsWith("/")) {
        siteViews += item.views;
      } else {
        postViews += item.views;
      }
    }

    return NextResponse.json({
      commentCount,
      userCount,
      siteViews,
      postViews,
      totalViews: siteViews,
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
