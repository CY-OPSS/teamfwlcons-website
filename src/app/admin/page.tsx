"use client";

import { useEffect, useState } from "react";
import { TEAM_ROLES, formatTeamRole } from "@/lib/team-roles";

type Tab = "posts" | "team" | "comments" | "stats";

interface Post {
  slug: string;
  title: string;
  date: string;
  category: string;
  content: string;
  sha: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
  avatar?: string;
  bio: string;
  social: Record<string, string>;
  stats: Record<string, string>;
}

interface CommentItem {
  id: string;
  content: string;
  postSlug: string;
  locale: string;
  createdAt: string;
  user: { username: string; name: string | null };
}

interface StatsData {
  commentCount: number;
  userCount: number;
  totalViews: number;
  topPages: { slug: string; locale: string; views: number }[];
  analyticsUrl: string;
}

const REPO = "CY-OPSS/teamfwlcons-website";
const DEPLOY_HOOK =
  "https://api.vercel.com/v1/integrations/deploy/prj_6L84y6UWCv4NZhJl2lXxQbpX9ZV1/hzXqDN3s2A";
const MEMBERS_PATH = "src/content/team/members.yml";

function encodeBase64(text: string) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(content: string) {
  const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
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
          twitter: get("twitter") || undefined,
          github: get("github") || undefined,
          discord: get("discord") || undefined,
        } as Record<string, string>,
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
    content: "",
  });

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersSha, setMembersSha] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      void bootstrap(savedToken);
    }
  }, []);

  const bootstrap = async (t: string) => {
    await Promise.all([
      loadPosts(t),
      loadMembers(t),
      loadComments(t),
      loadStats(t),
    ]);
  };

  const login = async () => {
    if (!token.trim()) return;
    localStorage.setItem("github_token", token.trim());
    setIsLoggedIn(true);
    await bootstrap(token.trim());
  };

  const logout = () => {
    localStorage.removeItem("github_token");
    setIsLoggedIn(false);
    setToken("");
    setPosts([]);
    setMembers([]);
    setComments([]);
    setStats(null);
  };

  const triggerDeploy = async () => {
    try {
      await fetch(DEPLOY_HOOK, { method: "POST" });
    } catch {
      // ignore
    }
  };

  const authHeaders = (t: string) => ({
    Authorization: `token ${t}`,
    Accept: "application/vnd.github.v3+json",
  });

  const loadPosts = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/content/blog/zh`,
        { headers: authHeaders(t) }
      );
      const data = await res.json();
      if (!Array.isArray(data)) {
        setMessage("加载文章失败，请检查 Token 权限");
        setLoading(false);
        return;
      }

      const postList = await Promise.all(
        data
          .filter((f: { name: string }) => f.name.endsWith(".md"))
          .map(async (f: { name: string; url: string }) => {
            const contentRes = await fetch(f.url, {
              headers: authHeaders(t),
            });
            const contentData = await contentRes.json();
            const content = decodeBase64(contentData.content);
            const match = content.match(/---\n([\s\S]*?)\n---\n([\s\S]*)/);
            let title = f.name.replace(".md", "");
            let date = "";
            let category = "";
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
            }
            return {
              slug: f.name.replace(".md", ""),
              title,
              date,
              category,
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

    const frontmatter = `---
title: "${newPost.title}"
description: ""
date: "${newPost.date}"
category: "${newPost.category}"
tags: []
---

${newPost.content}`;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/content/blog/zh/${slug}.md`,
        {
          method: "PUT",
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `feat: add blog post "${newPost.title}"`,
            content: encodeBase64(frontmatter),
          }),
        }
      );

      if (res.ok) {
        setMessage("文章创建成功，正在自动部署...");
        setNewPost({
          title: "",
          date: new Date().toISOString().split("T")[0],
          category: "新闻",
          content: "",
        });
        await loadPosts(token);
        await triggerDeploy();
      } else {
        setMessage("创建失败，请检查 token 权限");
      }
    } catch {
      setMessage("创建失败，请重试");
    }
  };

  const updatePost = async () => {
    if (!editing) return;
    const frontmatter = `---
title: "${editing.title}"
description: ""
date: "${editing.date}"
category: "${editing.category}"
tags: []
---

${editing.content}`;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/content/blog/zh/${editing.slug}.md`,
        {
          method: "PUT",
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `update: edit blog post "${editing.title}"`,
            content: encodeBase64(frontmatter),
            sha: editing.sha,
          }),
        }
      );

      if (res.ok) {
        setMessage("文章更新成功，正在自动部署...");
        setEditing(null);
        await loadPosts(token);
        await triggerDeploy();
      } else {
        setMessage("更新失败");
      }
    } catch {
      setMessage("更新失败，请重试");
    }
  };

  const deletePost = async (post: Post) => {
    if (!confirm(`确定要删除文章 "${post.title}" 吗？`)) return;
    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/content/blog/zh/${post.slug}.md`,
        { headers: authHeaders(token) }
      );
      const fileData = await fileRes.json();
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/content/blog/zh/${post.slug}.md`,
        {
          method: "DELETE",
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `delete: remove blog post "${post.title}"`,
            sha: fileData.sha,
          }),
        }
      );
      if (res.ok) {
        setMessage("文章已删除，正在自动部署...");
        setEditing(null);
        await loadPosts(token);
        await triggerDeploy();
      } else {
        const errData = await res.json();
        setMessage(`删除失败: ${errData.message || "未知错误"}`);
      }
    } catch (err) {
      setMessage(`删除失败: ${err}`);
    }
  };

  const loadMembers = async (t: string) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${MEMBERS_PATH}`,
        { headers: authHeaders(t) }
      );
      const data = await res.json();
      if (!data.content) {
        setMessage("加载团队成员失败");
        return;
      }
      const raw = decodeBase64(data.content);
      setMembersSha(data.sha);
      setMembers(parseMembersYaml(raw));
    } catch {
      setMessage("加载团队成员失败");
    }
  };

  const saveMembers = async () => {
    try {
      const yaml = membersToYaml(members);
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${MEMBERS_PATH}`,
        {
          method: "PUT",
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "update: edit team members",
            content: encodeBase64(yaml),
            sha: membersSha,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMembersSha(data.content.sha);
        setMessage("团队成员已保存，正在自动部署...");
        setEditingMemberId(null);
        await triggerDeploy();
      } else {
        const err = await res.json();
        setMessage(`保存失败: ${err.message || "未知错误"}`);
      }
    } catch {
      setMessage("保存团队成员失败");
    }
  };

  const uploadAvatar = async (memberId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) return;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `public/images/team/${memberId}.${ext}`;

      try {
        // Check if exists
        let sha: string | undefined;
        const existing = await fetch(
          `https://api.github.com/repos/${REPO}/contents/${path}`,
          { headers: authHeaders(token) }
        );
        if (existing.ok) {
          const existingData = await existing.json();
          sha = existingData.sha;
        }

        const res = await fetch(
          `https://api.github.com/repos/${REPO}/contents/${path}`,
          {
            method: "PUT",
            headers: {
              ...authHeaders(token),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `update: upload avatar for ${memberId}`,
              content: base64,
              ...(sha ? { sha } : {}),
            }),
          }
        );

        if (res.ok) {
          const avatarUrl = `/images/team/${memberId}.${ext}`;
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId ? { ...m, avatar: avatarUrl } : m
            )
          );
          setMessage("头像已上传，请再点「保存团队」写入配置");
        } else {
          setMessage("头像上传失败");
        }
      } catch {
        setMessage("头像上传失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const loadComments = async (t: string) => {
    try {
      const res = await fetch("/api/admin/comments", {
        headers: { Authorization: `Bearer ${t}` },
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

  const loadStats = async (t: string) => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${t}` },
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
            TeamFwlcons 管理后台
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
            Token 需要 repo 权限
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
          <h1 className="text-xl font-bold">TeamFwlcons 管理后台</h1>
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
                onClick={() => loadComments(token)}
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
                        {comment.user.username} · {comment.postSlug} ·{" "}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">文章浏览总量</div>
                <div className="text-3xl font-bold mt-2">
                  {stats?.totalViews ?? "—"}
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
                全站访客趋势、来源地区等请在 Vercel Analytics
                查看（已接入 @vercel/analytics）。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
