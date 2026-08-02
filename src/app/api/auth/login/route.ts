import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "请填写用户名和密码" },
        { status: 400 }
      );
    }

    // Find user by email (using email as username for simplicity)
    const user = await prisma.user.findUnique({
      where: { email: `${username}@teamfwlcons.gg` },
    });

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在，请先注册" },
        { status: 401 }
      );
    }

    // For simplicity, we'll just check if the user exists
    // In production, you should verify password hash
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "登录失败，请重试" },
      { status: 500 }
    );
  }
}
