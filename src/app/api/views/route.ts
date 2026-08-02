import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { slug, locale } = await request.json();

    if (!slug || !locale) {
      return NextResponse.json(
        { error: "Missing slug or locale" },
        { status: 400 }
      );
    }

    const viewStat = await prisma.viewStat.upsert({
      where: {
        slug_locale: { slug, locale },
      },
      update: {
        views: { increment: 1 },
      },
      create: {
        slug,
        locale,
        views: 1,
      },
    });

    return NextResponse.json({ views: viewStat.views });
  } catch {
    return NextResponse.json(
      { error: "Failed to update view count" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const locale = searchParams.get("locale") || "zh";

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    const viewStat = await prisma.viewStat.findUnique({
      where: {
        slug_locale: { slug, locale },
      },
    });

    return NextResponse.json({ views: viewStat?.views ?? 0 });
  } catch {
    return NextResponse.json(
      { error: "Failed to get view count" },
      { status: 500 }
    );
  }
}
