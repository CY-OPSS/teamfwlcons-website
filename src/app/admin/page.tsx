"use client";

import { useEffect, useState } from "react";
import { TEAM_ROLES, formatTeamRole } from "@/lib/team-roles";

type Tab = "posts" | "docs" | "about" | "team" | "comments" | "stats";

interface Post {
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  content: string;
  sha: string;
}

interface DocItem {
  slug: string;
  title: string;
  description: string;
  order: number;
  content: string;
  sha: string;
}

interface AboutHonor {
  title: string;
  year: string;
  icon: string;
}

interface AboutContact {
  label: string;
  detail: string;
  url: string;
  icon: string;
}

interface AboutData {
  history: string[];
  honors: AboutHonor[];
  contacts: AboutContact[];
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
  avatar?: string;
  bio: string;
  fiveEUrl?: string;
  social: Record<string, string>;
  stats: Record<string, string>;
}

interface CommentItem {
  id: string;
  content: string;
  postSlug: string;
  locale: string;
  parentId?: string | null;
  createdAt: string;
  user: { username: string; name: string | null };
}

interface StatsData {
  commentCount: number;
  userCount: number;
  siteViews: number;
  postViews: number;
  totalViews: number;
  topPages: { slug: string; locale: string; views: number }[];
  analyticsUrl: string;
}

const MEMBERS_PATH = "src/content/team/members.yml";
const DOCS_DIR = "src/content/docs/zh";
const ABOUT_PATH = "src/content/about/zh.json";

function emptyAbout(): AboutData {
  return { history: [""], honors: [], contacts: [] };
}

function slugifyDoc(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "");
}

async function readContent(path: string) {
  const res = await fetch(
    `/api/admin/content?path=${encodeURIComponent(path)}`,
    { credentials: "same-origin" }
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function writeContent(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/content", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function removeContent(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/content", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function parseTagList(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTagsYaml(tags: string[]) {
  if (tags.length === 0) return "[]";
  return `[${tags.map((tag) => `"${tag.replace(/"/g, '\\"')}"`).join(", ")}]`;
}

function parseTagsFromFrontmatter(frontmatter: string): string[] {
  const match = frontmatter.match(/tags:\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return parseTagList(match[1].replace(/["']/g, ""));
}

function membersToYaml(members: TeamMember[]) {
  const lines = ["---", "members:"];
  for (const member of members) {
    lines.push(`  - id: "${member.id}"`);
    lines.push(`    name: "${member.name.replace(/"/g, '\\"')}"`);
    lines.push(`    role: "${member.role}"`);
    lines.push(`    isCaptain: ${member.isCaptain ? "true" : "false"}`);
    if (member.avatar) {
      lines.push(`    avatar: "${member.avatar}"`);
    }
    lines.push(
      `    bio: "${(member.bio || "").replace(/"/g, '\\"').replace(/\n/g, " ")}"`
    );
    lines.push(`    fiveEUrl: "${member.fiveEUrl || ""}"`);
    lines.push("    social:");
    const socialKeys = Object.keys(member.social || {}).filter(
      (key) => member.social[key]
    );
    if (socialKeys.length === 0) {
      lines.pop();
      lines.push("    social: {}");
    } else {
      for (const key of socialKeys) {
        lines.push(`      ${key}: "${member.social[key]}"`);
      }
    }
    lines.push("    stats:");
    const statsKeys = Object.keys(member.stats || {}).filter(
      (key) => member.stats[key]
    );
    if (statsKeys.length === 0) {
      lines.pop();
      lines.push("    stats: {}");
    } else {
      for (const key of statsKeys) {
        lines.push(`      ${key}: "${member.stats[key]}"`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function parseMembersYaml(raw: string): TeamMember[] {
  const { data } = (() => {
    // Minimal frontmatter parse for members.yml
    const body = raw.replace(/^---\n/, "");
    const members: TeamMember[] = [];
    const blocks = body.split(/\n\s*-\s+id:/).slice(1);
    for (const block of blocks) {
      const text = `id:${block}`;
      const get = (key: string) => {
        const m = text.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`));
        return m?.[1]?.trim() || "";
      };
      const id = get("id");
      if (!id) continue;
      members.push({
        id,
        name: get("name") || "Unknown",
        role: get("role") || "Support",
        isCaptain: /isCaptain:\s*true/.test(text),
        avatar: get("avatar") || undefined,
        bio: get("bio") || "",
        social: {
          steam: get("steam") || undefined,
          telegram: get("telegram") || undefined,
          github: get("github") || undefined,
        } as Record<string, string>,
        fiveEUrl: get("fiveEUrl") || undefined,
        stats: {
          rating: get("rating") || undefined,
          headshot: get("headshot") || undefined,
          winRate: get("winRate") || undefined,
        } as Record<string, string>,
      });
    }
    return { data: members };
  })();
  return data;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [newPost, setNewPost] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    category: "新闻",
    tags: "",
    content: "",
  });

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);
  const [newDoc, setNewDoc] = useState({
    slug: "",
    title: "",
    description: "",
    order: 1,
    content: "",
  });

  const [about, setAbout] = useState<AboutData>(emptyAbout());
  const [aboutSha, setAboutSha] = useState("");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersSha, setMembersSha] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/admin/session", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return;
        setIsLoggedIn(true);
        await bootstrap();
      })
      .catch(() => undefined);
  }, []);

  const bootstrap = async () => {
    await Promise.all([
      loadPosts(),
      loadDocs(),
      loadAbout(),
      loadMembers(),
      loadComments(),
      loadStats(),
    ]);
  };

  const login = async () => {
    if (!token.trim()) return;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "登录失败");
      return;
    }
    setToken("");
    setIsLoggedIn(true);
    await bootstrap();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setIsLoggedIn(false);
    setToken("");
    setPosts([]);
    setDocs([]);
    setEditingDoc(null);
    setAbout(emptyAbout());
    setAboutSha("");
    setMembers([]);
    setComments([]);
    setStats(null);
  };

  const triggerDeploy = async () => {
    try {
      await fetch("/api/admin/deploy", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // ignore
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { res, data } = await readContent("src/content/blog/zh");
      const entries = data.entries as { name: string; path: string }[] | undefined;
      if (!res.ok || !Array.isArray(entries)) {
        setMessage(data.error || "加载文章失败");
        setLoading(false);
        return;
      }

      const postList = await Promise.all(
        entries
          .filter((f) => f.name.endsWith(".md"))
          .map(async (f) => {
            const contentRes = await readContent(f.path);
            const contentData = contentRes.data;
            const content = String(contentData.content || "");
            const match = content.match(/---\n([\s\S]*?)\n---\n([\s\S]*)/);
            let title = f.name.replace(".md", "");
            let date = "";
            let category = "";
            let tags: string[] = [];
            let body = content;
            if (match) {
              const frontmatter = match[1];
              body = match[2].trim();
              const titleMatch = frontmatter.match(/title:\s*"?(.+?)"?\s*$/m);
              const dateMatch = frontmatter.match(/date:\s*"?(.+?)"?\s*$/m);
              const categoryMatch = frontmatter.match(
                /category:\s*"?(.+?)"?\s*$/m
              );
              if (titleMatch) title = titleMatch[1];
              if (dateMatch) date = dateMatch[1];
              if (categoryMatch) category = categoryMatch[1];
              tags = parseTagsFromFrontmatter(frontmatter);
            }
            return {
              slug: f.name.replace(".md", ""),
              title,
              date,
              category,
              tags,
              content: body,
              sha: contentData.sha,
            };
          })
      );
      setPosts(postList);
    } catch {
      setMessage("加载文章失败");
    }
    setLoading(false);
  };

  const createPost = async () => {
    if (!newPost.title || !newPost.content) {
      setMessage("请填写标题和内容");
      return;
    }

    const slug = `${newPost.date}-${newPost.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "")}`;
    const tags = parseTagList(newPost.tags);

    const frontmatter = `---
title: "${newPost.title}"
description: ""
date: "${newPost.date}"
category: "${newPost.category}"
tags: ${formatTagsYaml(tags)}
---

${newPost.content}`;

    try {
      const { res, data } = await writeContent({
        path: `src/content/blog/zh/${slug}.md`,
        content: frontmatter,
        message: `feat: add blog post "${newPost.title}"`,
      });

      if (res.ok) {
        setMessage("文章创建成功，正在自动部署...");
        setNewPost({
          title: "",
          date: new Date().toISOString().split("T")[0],
          category: "新闻",
          tags: "",
          content: "",
        });
        await loadPosts();
        await triggerDeploy();
      } else {
        setMessage(data.error || "创建失败");
      }
    } catch {
      setMessage("创建失败，请重试");
    }
  };

  const updatePost = async () => {
    if (!editing) return;
    const tags = editing.tags || [];
    const frontmatter = `---
title: "${editing.title}"
description: ""
date: "${editing.date}"
category: "${editing.category}"
tags: ${formatTagsYaml(tags)}
---

${editing.content}`;

    try {
      const { res, data } = await writeContent({
        path: `src/content/blog/zh/${editing.slug}.md`,
        content: frontmatter,
        sha: editing.sha,
        message: `update: edit blog post "${editing.title}"`,
      });

      if (res.ok) {
        setMessage("文章更新成功，正在自动部署...");
        setEditing(null);
        await loadPosts();
        await triggerDeploy();
      } else {
        setMessage(data.error || "更新失败");
      }
    } catch {
      setMessage("更新失败，请重试");
    }
  };

  const deletePost = async (post: Post) => {
    if (!confirm(`确定要删除文章 "${post.title}" 吗？`)) return;
    try {
      const { res, data } = await removeContent({
        path: `src/content/blog/zh/${post.slug}.md`,
        sha: post.sha,
        message: `delete: remove blog post "${post.title}"`,
      });
      if (res.ok) {
        setMessage("文章已删除，正在自动部署...");
        setEditing(null);
        await loadPosts();
        await triggerDeploy();
      } else {
        setMessage(data.error || "删除失败");
      }
    } catch (err) {
      setMessage(`删除失败: ${err}`);
    }
  };

  const loadDocs = async () => {
    try {
      const { res, data } = await readContent(DOCS_DIR);
      const entries = data.entries as { name: string; path: string }[] | undefined;
      if (!res.ok || !Array.isArray(entries)) {
        setDocs([]);
        return;
      }

      const docList = await Promise.all(
        entries
          .filter((f) => f.name.endsWith(".md"))
          .map(async (f) => {
            const contentRes = await readContent(f.path);
            const contentData = contentRes.data;
            const content = String(contentData.content || "");
            const match = content.match(/---\n([\s\S]*?)\n---\n([\s\S]*)/);
            let title = f.name.replace(/\.md$/, "");
            let description = "";
            let order = 0;
            let body = content;
            if (match) {
              const frontmatter = match[1];
              body = match[2].trim();
              const titleMatch = frontmatter.match(/title:\s*"?(.+?)"?\s*$/m);
              const descMatch = frontmatter.match(
                /description:\s*"?(.+?)"?\s*$/m
              );
              const orderMatch = frontmatter.match(/order:\s*"?(\d+)"?\s*$/m);
              if (titleMatch) title = titleMatch[1];
              if (descMatch) description = descMatch[1];
              if (orderMatch) order = Number(orderMatch[1]) || 0;
            }
            return {
              slug: f.name.replace(/\.md$/, ""),
              title,
              description,
              order,
              content: body,
              sha: contentData.sha as string,
            } satisfies DocItem;
          })
      );
      setDocs(docList.sort((a, b) => a.order - b.order));
    } catch {
      setMessage("加载文档失败");
    }
  };

  const buildDocMarkdown = (doc: {
    title: string;
    description: string;
    order: number;
    content: string;
  }) => `---
title: "${doc.title.replace(/"/g, '\\"')}"
description: "${doc.description.replace(/"/g, '\\"')}"
order: ${Number(doc.order) || 0}
---

${doc.content}`;

  const createDoc = async () => {
    if (!newDoc.title || !newDoc.content) {
      setMessage("请填写文档标题和内容");
      return;
    }
    const slug = (newDoc.slug.trim() || slugifyDoc(newDoc.title)).replace(
      /^\/+|\/+$/g,
      ""
    );
    if (!slug) {
      setMessage("请填写有效的文档 slug");
      return;
    }

    try {
      const { res, data } = await writeContent({
        path: `${DOCS_DIR}/${slug}.md`,
        content: buildDocMarkdown(newDoc),
        message: `feat: add doc "${newDoc.title}"`,
      });
      if (res.ok) {
        setMessage("文档创建成功，正在自动部署...");
        setNewDoc({
          slug: "",
          title: "",
          description: "",
          order: docs.length + 1,
          content: "",
        });
        await loadDocs();
        await triggerDeploy();
      } else {
        setMessage(data.error || "创建文档失败");
      }
    } catch {
      setMessage("创建文档失败，请重试");
    }
  };

  const updateDoc = async () => {
    if (!editingDoc) return;
    try {
      const { res, data } = await writeContent({
        path: `${DOCS_DIR}/${editingDoc.slug}.md`,
        content: buildDocMarkdown(editingDoc),
        sha: editingDoc.sha,
        message: `update: edit doc "${editingDoc.title}"`,
      });
      if (res.ok) {
        setMessage("文档更新成功，正在自动部署...");
        setEditingDoc(null);
        await loadDocs();
        await triggerDeploy();
      } else {
        setMessage(data.error || "更新文档失败");
      }
    } catch {
      setMessage("更新文档失败，请重试");
    }
  };

  const deleteDoc = async (doc: DocItem) => {
    if (!confirm(`确定要删除文档 "${doc.title}" 吗？`)) return;
    try {
      const { res, data } = await removeContent({
        path: `${DOCS_DIR}/${doc.slug}.md`,
        sha: doc.sha,
        message: `delete: remove doc "${doc.title}"`,
      });
      if (res.ok) {
        setMessage("文档已删除，正在自动部署...");
        setEditingDoc(null);
        await loadDocs();
        await triggerDeploy();
      } else {
        setMessage(data.error || "删除文档失败");
      }
    } catch (err) {
      setMessage(`删除文档失败: ${err}`);
    }
  };

  const importDocFile = async (file: File) => {
    const text = await file.text();
    const match = text.match(/---\n([\s\S]*?)\n---\n([\s\S]*)/);
    let title = file.name.replace(/\.md$/i, "");
    let description = "";
    let order = docs.length + 1;
    let content = text;
    let slug = slugifyDoc(title);
    if (match) {
      const frontmatter = match[1];
      content = match[2].trim();
      const titleMatch = frontmatter.match(/title:\s*"?(.+?)"?\s*$/m);
      const descMatch = frontmatter.match(/description:\s*"?(.+?)"?\s*$/m);
      const orderMatch = frontmatter.match(/order:\s*"?(\d+)"?\s*$/m);
      if (titleMatch) title = titleMatch[1];
      if (descMatch) description = descMatch[1];
      if (orderMatch) order = Number(orderMatch[1]) || order;
    }
    slug = slugifyDoc(title) || slug;
    setEditingDoc(null);
    setNewDoc({ slug, title, description, order, content });
    setMessage(`已导入文件 ${file.name}，确认后点击发布`);
  };

  const loadAbout = async () => {
    try {
      const { res, data } = await readContent(ABOUT_PATH);
      if (!res.ok || typeof data.content !== "string") {
        setAbout(emptyAbout());
        setAboutSha("");
        return;
      }
      const raw = JSON.parse(data.content) as Partial<AboutData>;
      setAboutSha(data.sha);
      setAbout({
        history: Array.isArray(raw.history) ? raw.history.map(String) : [""],
        honors: Array.isArray(raw.honors)
          ? raw.honors.map((item) => ({
              title: String(item?.title || ""),
              year: String(item?.year || ""),
              icon: String(item?.icon || "🏆"),
            }))
          : [],
        contacts: Array.isArray(raw.contacts)
          ? raw.contacts.map((item) => ({
              label: String(item?.label || ""),
              detail: String(item?.detail || ""),
              url: String(item?.url || "#"),
              icon: String(item?.icon || "🔗"),
            }))
          : [],
      });
    } catch {
      setMessage("加载关于页失败");
    }
  };

  const saveAbout = async () => {
    try {
      const payload: AboutData = {
        history: about.history.map((p) => p.trim()).filter(Boolean),
        honors: about.honors.filter((h) => h.title.trim()),
        contacts: about.contacts.filter((c) => c.label.trim()),
      };
      const { res, data } = await writeContent({
        path: ABOUT_PATH,
        content: JSON.stringify(payload, null, 2) + "\n",
        message: "update: edit about page content",
        ...(aboutSha ? { sha: aboutSha } : {}),
      });
      if (res.ok) {
        setAboutSha(data.sha);
        setAbout(payload);
        setMessage("关于页已保存，正在自动部署...");
        await triggerDeploy();
      } else {
        setMessage(data.error || "保存关于页失败");
      }
    } catch {
      setMessage("保存关于页失败，请重试");
    }
  };

  const loadMembers = async () => {
    try {
      const { res, data } = await readContent(MEMBERS_PATH);
      if (!res.ok || typeof data.content !== "string") {
        setMessage(data.error || "加载团队成员失败");
        return;
      }
      const raw = data.content;
      setMembersSha(data.sha);
      setMembers(parseMembersYaml(raw));
    } catch {
      setMessage("加载团队成员失败");
    }
  };

  const saveMembers = async () => {
    try {
      const yaml = membersToYaml(members);
      const { res, data } = await writeContent({
        path: MEMBERS_PATH,
        content: yaml,
        sha: membersSha,
        message: "update: edit team members",
      });
      if (res.ok) {
        setMembersSha(data.sha);
        setMessage("团队成员已保存，正在自动部署...");
        setEditingMemberId(null);
        await triggerDeploy();
      } else {
        setMessage(data.error || "保存失败");
      }
    } catch {
      setMessage("保存团队成员失败");
    }
  };

  const fileToCompressedBase64 = (file: File): Promise<{ base64: string; ext: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("图片解析失败"));
        img.onload = () => {
          const maxSize = 800;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("浏览器不支持图片压缩"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (dataUrl.length > 900_000 && quality > 0.4) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          const base64 = dataUrl.split(",")[1];
          if (!base64) {
            reject(new Error("图片编码失败"));
            return;
          }
          if (base64.length > 1_000_000) {
            reject(new Error("图片仍然过大，请换一张更小的图"));
            return;
          }
          resolve({ base64, ext: "jpg" });
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });

  const uploadAvatar = async (memberId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage("请选择图片文件");
      return;
    }

    setMessage("正在压缩并上传头像...");
    try {
      const { base64, ext } = await fileToCompressedBase64(file);
      const path = `public/images/team/${memberId}.${ext}`;

      let sha: string | undefined;
      const existing = await readContent(path);
      if (existing.res.ok && typeof existing.data.sha === "string") {
        sha = existing.data.sha;
      } else if (existing.res.status !== 404) {
        setMessage(existing.data.error || "检查头像失败");
        return;
      }

      const uploaded = await writeContent({
        path,
        content: base64,
        isBase64: true,
        message: `update: upload avatar for ${memberId}`,
        ...(sha ? { sha } : {}),
      });

      if (!uploaded.res.ok) {
        setMessage(uploaded.data.error || "头像上传失败");
        return;
      }

      const avatarPath = `/images/team/${memberId}.${ext}`;
      const nextMembers = members.map((m) =>
        m.id === memberId ? { ...m, avatar: avatarPath } : m
      );
      setMembers(nextMembers);

      const yaml = membersToYaml(nextMembers);
      const saveRes = await writeContent({
        path: MEMBERS_PATH,
        content: yaml,
        sha: membersSha,
        message: `update: set avatar for ${memberId}`,
      });

      if (saveRes.res.ok) {
        setMembersSha(saveRes.data.sha);
        setMessage("头像上传成功，正在自动部署...");
        await triggerDeploy();
      } else {
        setMessage("头像文件已上传，但写入成员配置失败，请再点「保存团队」");
      }
    } catch (err) {
      setMessage(`头像上传失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const loadComments = async () => {
    try {
      const res = await fetch("/api/admin/comments", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (Array.isArray(data)) setComments(data);
    } catch {
      // ignore
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("确定删除这条评论吗？")) return;
    try {
      const res = await fetch("/api/admin/comments", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id));
        setMessage("评论已删除");
      } else {
        const data = await res.json();
        setMessage(data.error || "删除评论失败");
      }
    } catch {
      setMessage("删除评论失败");
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data && !data.error) setStats(data);
    } catch {
      // ignore
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4 text-center">
            Team Fwlcons 管理后台
          </h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            placeholder="GitHub Personal Access Token"
          />
          <button
            onClick={login}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            登录
          </button>
          <p className="mt-4 text-sm text-gray-500 text-center">
            登录用的 Token 不会保存在浏览器，建议使用仅限本仓库的细粒度 Token
          </p>
        </div>
      </div>
    );
  }

  const editingMember = members.find((m) => m.id === editingMemberId) || null;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Team Fwlcons 管理后台</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-blue-600 hover:underline">
              查看网站
            </a>
            <button onClick={logout} className="text-red-600 hover:underline">
              退出
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {message && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-lg font-bold">
              ×
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["posts", "文章"],
              ["docs", "文档"],
              ["about", "关于页"],
              ["team", "团队成员"],
              ["comments", "评论管理"],
              ["stats", "访问统计"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                tab === key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "posts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">
                已有文章 ({posts.length})
              </h2>
              {loading ? (
                <p className="text-gray-500">加载中...</p>
              ) : posts.length === 0 ? (
                <p className="text-gray-500">暂无文章</p>
              ) : (
                <ul className="space-y-3">
                  {posts.map((post) => (
                    <li
                      key={post.slug}
                      className={`p-4 rounded border cursor-pointer transition-colors ${
                        editing?.slug === post.slug
                          ? "bg-blue-50 border-blue-300"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => setEditing(post)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{post.title}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {post.date && <span>{post.date}</span>}
                            {post.category && (
                              <span className="ml-2">• {post.category}</span>
                            )}
                            {post.tags?.length > 0 && (
                              <span className="ml-2">
                                • {post.tags.map((tag) => `#${tag}`).join(" ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePost(post);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">
                {editing ? "编辑文章" : "发布新文章"}
              </h2>
              {editing && (
                <button
                  onClick={() => setEditing(null)}
                  className="mb-4 text-blue-600 hover:underline text-sm"
                >
                  ← 返回新建
                </button>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">标题</label>
                  <input
                    type="text"
                    value={editing ? editing.title : newPost.title}
                    onChange={(e) =>
                      editing
                        ? setEditing({ ...editing, title: e.target.value })
                        : setNewPost({ ...newPost, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="文章标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">日期</label>
                  <input
                    type="date"
                    value={editing ? editing.date : newPost.date}
                    onChange={(e) =>
                      editing
                        ? setEditing({ ...editing, date: e.target.value })
                        : setNewPost({ ...newPost, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">分类</label>
                  <select
                    value={editing ? editing.category : newPost.category}
                    onChange={(e) =>
                      editing
                        ? setEditing({ ...editing, category: e.target.value })
                        : setNewPost({ ...newPost, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="新闻">新闻</option>
                    <option value="赛事">赛事</option>
                    <option value="攻略">攻略</option>
                    <option value="技术">技术</option>
                    <option value="日常">日常</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">标签</label>
                  <input
                    type="text"
                    value={
                      editing ? (editing.tags || []).join("，") : newPost.tags
                    }
                    onChange={(e) =>
                      editing
                        ? setEditing({
                            ...editing,
                            tags: parseTagList(e.target.value),
                          })
                        : setNewPost({ ...newPost, tags: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="多个标签用逗号分隔，例如：纪念，战队，CS2"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    可新建任意标签，多个标签用中文或英文逗号分开
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    内容 (Markdown)
                  </label>
                  <textarea
                    value={editing ? editing.content : newPost.content}
                    onChange={(e) =>
                      editing
                        ? setEditing({ ...editing, content: e.target.value })
                        : setNewPost({ ...newPost, content: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md h-64 font-mono text-sm"
                    placeholder="文章内容，支持 Markdown 格式"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={editing ? updatePost : createPost}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                  >
                    {editing ? "保存修改" : "发布文章"}
                  </button>
                  {editing && (
                    <button
                      onClick={() => deletePost(editing)}
                      className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "docs" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">
                已有文档 ({docs.length})
              </h2>
              {docs.length === 0 ? (
                <p className="text-gray-500">暂无文档</p>
              ) : (
                <ul className="space-y-3">
                  {docs.map((doc) => (
                    <li
                      key={doc.slug}
                      className={`p-4 rounded border cursor-pointer transition-colors ${
                        editingDoc?.slug === doc.slug
                          ? "bg-blue-50 border-blue-300"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => setEditingDoc(doc)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{doc.title}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {doc.slug}.md · order {doc.order}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDoc(doc);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">
                  {editingDoc ? "编辑文档" : "新建 / 上传文档"}
                </h2>
                <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                  上传 .md
                  <input
                    type="file"
                    accept=".md,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importDocFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {editingDoc && (
                <button
                  onClick={() => setEditingDoc(null)}
                  className="mb-4 text-blue-600 hover:underline text-sm"
                >
                  ← 返回新建
                </button>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">标题</label>
                  <input
                    type="text"
                    value={editingDoc ? editingDoc.title : newDoc.title}
                    onChange={(e) =>
                      editingDoc
                        ? setEditingDoc({
                            ...editingDoc,
                            title: e.target.value,
                          })
                        : setNewDoc({ ...newDoc, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="文档标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    文件名 (slug)
                  </label>
                  <input
                    type="text"
                    value={editingDoc ? editingDoc.slug : newDoc.slug}
                    onChange={(e) =>
                      editingDoc
                        ? undefined
                        : setNewDoc({ ...newDoc, slug: e.target.value })
                    }
                    disabled={!!editingDoc}
                    className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                    placeholder="例如 getting-started（留空则按标题生成）"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">简介</label>
                  <input
                    type="text"
                    value={
                      editingDoc ? editingDoc.description : newDoc.description
                    }
                    onChange={(e) =>
                      editingDoc
                        ? setEditingDoc({
                            ...editingDoc,
                            description: e.target.value,
                          })
                        : setNewDoc({
                            ...newDoc,
                            description: e.target.value,
                          })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="文档简介"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input
                    type="number"
                    value={editingDoc ? editingDoc.order : newDoc.order}
                    onChange={(e) => {
                      const order = Number(e.target.value) || 0;
                      if (editingDoc) {
                        setEditingDoc({ ...editingDoc, order });
                      } else {
                        setNewDoc({ ...newDoc, order });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    内容 (Markdown)
                  </label>
                  <textarea
                    value={editingDoc ? editingDoc.content : newDoc.content}
                    onChange={(e) =>
                      editingDoc
                        ? setEditingDoc({
                            ...editingDoc,
                            content: e.target.value,
                          })
                        : setNewDoc({ ...newDoc, content: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md h-64 font-mono text-sm"
                    placeholder="文档内容，支持 Markdown"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={editingDoc ? updateDoc : createDoc}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                  >
                    {editingDoc ? "保存修改" : "发布文档"}
                  </button>
                  {editingDoc && (
                    <button
                      onClick={() => deleteDoc(editingDoc)}
                      className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "about" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">编辑关于页</h2>
              <button
                onClick={saveAbout}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                保存关于页
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">战队历史</h3>
                <button
                  onClick={() =>
                    setAbout((prev) => ({
                      ...prev,
                      history: [...prev.history, ""],
                    }))
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  + 添加段落
                </button>
              </div>
              {about.history.map((paragraph, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    value={paragraph}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        history: prev.history.map((p, i) =>
                          i === index ? e.target.value : p
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-md h-24"
                    placeholder={`第 ${index + 1} 段`}
                  />
                  <button
                    onClick={() =>
                      setAbout((prev) => ({
                        ...prev,
                        history: prev.history.filter((_, i) => i !== index),
                      }))
                    }
                    className="text-red-500 text-sm shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">荣誉成就</h3>
                <button
                  onClick={() =>
                    setAbout((prev) => ({
                      ...prev,
                      honors: [
                        ...prev.honors,
                        { title: "", year: "", icon: "🏆" },
                      ],
                    }))
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  + 添加荣誉
                </button>
              </div>
              {about.honors.map((honor, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2 border-b pb-4"
                >
                  <input
                    type="text"
                    value={honor.icon}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        honors: prev.honors.map((h, i) =>
                          i === index ? { ...h, icon: e.target.value } : h
                        ),
                      }))
                    }
                    className="px-3 py-2 border rounded-md"
                    placeholder="图标"
                  />
                  <input
                    type="text"
                    value={honor.title}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        honors: prev.honors.map((h, i) =>
                          i === index ? { ...h, title: e.target.value } : h
                        ),
                      }))
                    }
                    className="sm:col-span-2 px-3 py-2 border rounded-md"
                    placeholder="荣誉名称"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={honor.year}
                      onChange={(e) =>
                        setAbout((prev) => ({
                          ...prev,
                          honors: prev.honors.map((h, i) =>
                            i === index ? { ...h, year: e.target.value } : h
                          ),
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="年份"
                    />
                    <button
                      onClick={() =>
                        setAbout((prev) => ({
                          ...prev,
                          honors: prev.honors.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-red-500 text-sm shrink-0"
                    >
                      删
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">联系方式</h3>
                <button
                  onClick={() =>
                    setAbout((prev) => ({
                      ...prev,
                      contacts: [
                        ...prev.contacts,
                        { label: "", detail: "", url: "#", icon: "🔗" },
                      ],
                    }))
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  + 添加联系方式
                </button>
              </div>
              {about.contacts.map((contact, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b pb-4"
                >
                  <input
                    type="text"
                    value={contact.icon}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        contacts: prev.contacts.map((c, i) =>
                          i === index ? { ...c, icon: e.target.value } : c
                        ),
                      }))
                    }
                    className="px-3 py-2 border rounded-md"
                    placeholder="图标"
                  />
                  <input
                    type="text"
                    value={contact.label}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        contacts: prev.contacts.map((c, i) =>
                          i === index ? { ...c, label: e.target.value } : c
                        ),
                      }))
                    }
                    className="px-3 py-2 border rounded-md"
                    placeholder="名称（如 Telegram）"
                  />
                  <input
                    type="text"
                    value={contact.detail}
                    onChange={(e) =>
                      setAbout((prev) => ({
                        ...prev,
                        contacts: prev.contacts.map((c, i) =>
                          i === index ? { ...c, detail: e.target.value } : c
                        ),
                      }))
                    }
                    className="px-3 py-2 border rounded-md"
                    placeholder="说明文字"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={contact.url}
                      onChange={(e) =>
                        setAbout((prev) => ({
                          ...prev,
                          contacts: prev.contacts.map((c, i) =>
                            i === index ? { ...c, url: e.target.value } : c
                          ),
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="链接 URL"
                    />
                    <button
                      onClick={() =>
                        setAbout((prev) => ({
                          ...prev,
                          contacts: prev.contacts.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-red-500 text-sm shrink-0"
                    >
                      删
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "team" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">成员列表 ({members.length})</h2>
                <button
                  onClick={saveMembers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  保存团队
                </button>
              </div>
              <ul className="space-y-3">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className={`p-4 rounded border cursor-pointer ${
                      editingMemberId === member.id
                        ? "bg-blue-50 border-blue-300"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                    onClick={() => setEditingMemberId(member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-blue-600">
                            {member.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-gray-500">
                          {formatTeamRole(member.role, member.isCaptain)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">编辑成员</h2>
              {!editingMember ? (
                <p className="text-gray-500">选择左侧成员进行编辑</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">名字</label>
                    <input
                      type="text"
                      value={editingMember.name}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? { ...m, name: e.target.value }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">角色</label>
                    <select
                      value={editingMember.role}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? {
                                  ...m,
                                  role: e.target.value,
                                  isCaptain:
                                    e.target.value === "Coach"
                                      ? false
                                      : m.isCaptain,
                                }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="isCaptain"
                      type="checkbox"
                      checked={editingMember.isCaptain}
                      disabled={editingMember.role === "Coach"}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? { ...m, isCaptain: e.target.checked }
                              : m
                          )
                        )
                      }
                    />
                    <label htmlFor="isCaptain" className="text-sm">
                      同时是队长（显示为 Captain / 角色）
                    </label>
                  </div>
                  <div className="text-sm text-gray-500">
                    预览：{formatTeamRole(editingMember.role, editingMember.isCaptain)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">简介</label>
                    <textarea
                      value={editingMember.bio}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? { ...m, bio: e.target.value }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Steam 个人主页
                    </label>
                    <input
                      type="text"
                      value={editingMember.social.steam || ""}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? {
                                  ...m,
                                  social: {
                                    ...m.social,
                                    steam: e.target.value,
                                  },
                                }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="https://steamcommunity.com/id/你的ID 或 /profiles/数字ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Telegram
                    </label>
                    <input
                      type="text"
                      value={editingMember.social.telegram || ""}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? {
                                  ...m,
                                  social: {
                                    ...m.social,
                                    telegram: e.target.value,
                                  },
                                }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="https://t.me/你的用户名"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      5E 个人主页（可选）
                    </label>
                    <input
                      type="text"
                      value={editingMember.fiveEUrl || ""}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? { ...m, fiveEUrl: e.target.value }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="https://arena.5eplay.com/data/player/你的ID"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      前台展示用公开链接。自动同步的玩家 ID / Token 请放到
                      GitHub Secrets（见 docs/5e-stats-setup.md），不要写进仓库。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      头像 URL
                    </label>
                    <input
                      type="text"
                      value={editingMember.avatar || ""}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((m) =>
                            m.id === editingMember.id
                              ? { ...m, avatar: e.target.value }
                              : m
                          )
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="/images/team/captain.jpg 或 https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      上传头像
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadAvatar(editingMember.id, file);
                      }}
                    />
                  </div>
                  <button
                    onClick={saveMembers}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                  >
                    保存团队修改
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "comments" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">评论管理 ({comments.length})</h2>
              <button
                onClick={() => loadComments()}
                className="text-sm text-blue-600 hover:underline"
              >
                刷新
              </button>
            </div>
            {comments.length === 0 ? (
              <p className="text-gray-500">暂无评论</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="p-4 border rounded-md bg-gray-50 flex justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm text-gray-500 mb-1">
                        {comment.user.username} · {comment.postSlug}
                        {comment.parentId ? " · 回复" : ""} ·{" "}
                        {new Date(comment.createdAt).toLocaleString("zh-CN")}
                      </div>
                      <div className="text-gray-800">{comment.content}</div>
                    </div>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="text-red-600 hover:underline text-sm shrink-0"
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6 sm:col-span-2 lg:col-span-1 border-l-4 border-blue-600">
                <div className="text-sm text-gray-500">全站访问量</div>
                <div className="text-3xl font-bold mt-2">
                  {stats
                    ? (stats.siteViews ?? stats.totalViews).toLocaleString()
                    : "—"}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  首页、团队、博客等所有公开页面累计
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">文章浏览总量</div>
                <div className="text-3xl font-bold mt-2">
                  {stats ? (stats.postViews ?? 0).toLocaleString() : "—"}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">注册用户</div>
                <div className="text-3xl font-bold mt-2">
                  {stats?.userCount ?? "—"}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">评论数</div>
                <div className="text-3xl font-bold mt-2">
                  {stats?.commentCount ?? "—"}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">热门页面（站内统计）</h2>
                <a
                  href={
                    stats?.analyticsUrl ||
                    "https://vercel.com/facwink/teamfwlcons-website/analytics"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  打开 Vercel Analytics →
                </a>
              </div>
              {!stats?.topPages?.length ? (
                <p className="text-gray-500">暂无浏览数据</p>
              ) : (
                <ul className="space-y-2">
                  {stats.topPages.map((page) => (
                    <li
                      key={`${page.locale}-${page.slug}`}
                      className="flex justify-between border-b py-2 text-sm"
                    >
                      <span>
                        [{page.locale}] {page.slug}
                      </span>
                      <span className="font-medium">{page.views} 次</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-500 mt-4">
                全站访问量从本次部署起开始累计。访客趋势、来源地区等可在
                Vercel Analytics 查看。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
