import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const trimmed = typeof username === "string" ? username.trim() : "";

    if (!trimmed || !password) {
      return NextResponse.json(
        { error: "请填写用户名和密码" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: trimmed },
    });

    if (!user) {
      // 新用户自动注册
      if (typeof password !== "string" || password.length < 6) {
        return NextResponse.json(
          { error: "新用户密码至少6个字符" },
          { status: 400 }
        );
      }
      if (trimmed.length < 3) {
        return NextResponse.json(
          { error: "用户名至少3个字符" },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await prisma.user.create({
        data: {
          username: trimmed,
          passwordHash,
          name: trimmed,
        },
      });

      const token = await createSessionToken({
        userId: created.id,
        username: created.username,
        role: created.role,
      });

      const response = NextResponse.json({
        user: {
          id: created.id,
          username: created.username,
          role: created.role,
        },
        created: true,
      });
      setSessionCookie(response, token);
      return response;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      created: false,
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "登录失败，请确认数据库已配置" },
      { status: 500 }
    );
  }
}
