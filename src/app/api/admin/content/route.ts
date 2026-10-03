import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  ContentAuthError,
  ContentConflictError,
  ContentConfigError,
  ContentPathError,
  deleteFile,
  getEntry,
  putFile,
} from "@/lib/github-content";

function fail(error: unknown) {
  if (error instanceof ContentPathError) {
    return NextResponse.json({ error: "路径不允许" }, { status: 400 });
  }
  if (error instanceof ContentConflictError) {
    return NextResponse.json(
      { error: error.message, sha: error.sha },
      { status: 409 }
    );
  }
  if (error instanceof ContentConfigError) {
    return NextResponse.json({ error: "后台写入未配置" }, { status: 503 });
  }
  if (error instanceof ContentAuthError) {
    return NextResponse.json(
      { error: "仓库凭据失效，请联系管理员续期" },
      { status: 502 }
    );
  }
  const status = (error as { status?: number })?.status;
  if (status === 404) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  if (status === 413) {
    return NextResponse.json({ error: "内容过大" }, { status: 413 });
  }
  console.error("Admin content error", error);
  return NextResponse.json({ error: "仓库操作失败" }, { status: 500 });
}

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const path = new URL(request.url).searchParams.get("path") || "";
  try {
    const result = await getEntry(path);
    if (Array.isArray(result)) {
      return NextResponse.json({ entries: result });
    }
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const path = typeof body?.path === "string" ? body.path : "";
    const content = typeof body?.content === "string" ? body.content : "";
    const saved = await putFile({
      path,
      content,
      isBase64: body?.isBase64 === true,
      sha: typeof body?.sha === "string" ? body.sha : undefined,
      message: typeof body?.message === "string" ? body.message : undefined,
    });
    return NextResponse.json({ sha: saved.sha });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    await deleteFile({
      path: typeof body?.path === "string" ? body.path : "",
      sha: typeof body?.sha === "string" ? body.sha : "",
      message: typeof body?.message === "string" ? body.message : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
