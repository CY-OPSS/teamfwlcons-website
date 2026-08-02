import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import GithubProvider from "next-auth/providers/github";

const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { content, postSlug, locale } = await request.json();

    if (!content || !postSlug) {
      return NextResponse.json(
        { error: "Missing content or postSlug" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postSlug,
        locale: locale || "zh",
        userId: user.id,
        approved: user.role === "ADMIN",
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    });

    return NextResponse.json(comment);
  } catch {
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

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
          select: { name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch {
    return NextResponse.json(
      { error: "Failed to get comments" },
      { status: 500 }
    );
  }
}
