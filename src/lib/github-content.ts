const API = "https://api.github.com";
const DEFAULT_REPO = "CY-OPSS/teamfwlcons-website";
const MAX_BYTES = 900 * 1024;
const ALLOWED_PREFIX = /^(src\/content|public\/images)\//;

export type ContentEntry = {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  size?: number;
};

export type ContentFile = {
  path: string;
  sha: string;
  content: string;
  encoding: "utf-8" | "base64";
};

export class ContentPathError extends Error {
  constructor() {
    super("路径不允许");
  }
}

export class ContentConflictError extends Error {
  sha?: string;
  constructor(sha?: string) {
    super("内容已被他人修改，请刷新");
    this.sha = sha;
  }
}

export class ContentConfigError extends Error {
  constructor() {
    super("后台写入未配置");
  }
}

/** GITHUB_CONTENT_TOKEN 到期日 2026-11-02。到期后续期，否则后台写入会停。 */
export class ContentAuthError extends Error {
  constructor() {
    super("仓库凭据失效，请联系管理员续期");
  }
}

export function contentRepo() {
  return process.env.ADMIN_REPO || DEFAULT_REPO;
}

function token() {
  const value = process.env.GITHUB_CONTENT_TOKEN?.trim();
  if (!value) throw new ContentConfigError();
  return value;
}

export function assertContentPath(path: string) {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..") ||
    !ALLOWED_PREFIX.test(path)
  ) {
    throw new ContentPathError();
  }
}

async function github(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return res;
}

function assertAuthed(res: Response) {
  if (res.status === 401 || res.status === 403) throw new ContentAuthError();
}

function encodeRepoPath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function getEntry(
  path: string
): Promise<ContentEntry[] | ContentFile> {
  assertContentPath(path);
  const res = await github(
    `/repos/${contentRepo()}/contents/${encodeRepoPath(path)}`
  );
  if (res.status === 404) {
    throw Object.assign(new Error("文件不存在"), { status: 404 });
  }
  assertAuthed(res);
  if (!res.ok) {
    console.error("GitHub get content failed", res.status);
    throw new Error("读取仓库失败");
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map((item) => ({
      name: String(item.name),
      path: String(item.path),
      sha: String(item.sha),
      type: item.type === "dir" ? "dir" : "file",
      size: typeof item.size === "number" ? item.size : undefined,
    }));
  }
  const raw =
    typeof data.content === "string" ? data.content.replace(/\n/g, "") : "";
  const binary = path.startsWith("public/images/");
  const content = binary ? raw : Buffer.from(raw, "base64").toString("utf8");
  return {
    path: String(data.path),
    sha: String(data.sha),
    content,
    encoding: binary ? "base64" : "utf-8",
  };
}

export async function putFile(input: {
  path: string;
  content: string;
  isBase64?: boolean;
  sha?: string;
  message?: string;
}): Promise<{ sha: string; commit: string }> {
  assertContentPath(input.path);
  const bytes = Buffer.byteLength(
    input.isBase64 ? input.content : input.content,
    input.isBase64 ? "base64" : "utf8"
  );
  if (bytes > MAX_BYTES) {
    throw Object.assign(new Error("内容过大"), { status: 413 });
  }
  const content = input.isBase64
    ? input.content
    : Buffer.from(input.content, "utf8").toString("base64");
  const res = await github(
    `/repos/${contentRepo()}/contents/${encodeRepoPath(input.path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: input.message || `update: ${input.path}`,
        content,
        ...(input.sha ? { sha: input.sha } : {}),
      }),
    }
  );
  if (res.status === 409) {
    let sha: string | undefined;
    try {
      const body = await res.json();
      sha = typeof body?.sha === "string" ? body.sha : undefined;
    } catch {
      sha = undefined;
    }
    throw new ContentConflictError(sha);
  }
  assertAuthed(res);
  if (!res.ok) {
    console.error("GitHub put content failed", res.status);
    throw new Error("写入仓库失败");
  }
  const data = await res.json();
  return {
    sha: String(data?.content?.sha || ""),
    commit: String(data?.commit?.sha || ""),
  };
}

export async function deleteFile(input: {
  path: string;
  sha: string;
  message?: string;
}): Promise<void> {
  assertContentPath(input.path);
  if (!input.sha) throw new ContentPathError();
  const res = await github(
    `/repos/${contentRepo()}/contents/${encodeRepoPath(input.path)}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        message: input.message || `delete: ${input.path}`,
        sha: input.sha,
      }),
    }
  );
  if (res.status === 409) throw new ContentConflictError();
  assertAuthed(res);
  if (!res.ok) {
    console.error("GitHub delete content failed", res.status);
    throw new Error("删除仓库文件失败");
  }
}
