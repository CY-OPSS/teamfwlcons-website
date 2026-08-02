"use client";

import { useState, useEffect } from "react";

interface Post {
  slug: string;
  title: string;
  date: string;
  category: string;
  content: string;
  sha: string;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [newPost, setNewPost] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    category: "新闻",
    content: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      loadPosts(savedToken);
    }
  }, []);

  const login = async () => {
    if (!token.trim()) return;
    localStorage.setItem("github_token", token.trim());
    setIsLoggedIn(true);
    await loadPosts(token.trim());
  };

  const logout = () => {
    localStorage.removeItem("github_token");
    setIsLoggedIn(false);
    setToken("");
    setPosts([]);
  };

  const DEPLOY_HOOK = "https://api.vercel.com/v1/integrations/deploy/prj_6L84y6UWCv4NZhJl2lXxQbpX9ZV1/hzXqDN3s2A";

  const triggerDeploy = async () => {
    try {
      await fetch(DEPLOY_HOOK, { method: "POST" });
    } catch {
      // Silent fail
    }
  };

  const loadPosts = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        "https://api.github.com/repos/CY-OPSS/teamfwlcons-website/contents/src/content/blog/zh",
        {
          headers: {
            Authorization: `token ${t}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const postList = await Promise.all(
          data
            .filter((f: { name: string }) => f.name.endsWith(".md"))
            .map(async (f: { name: string; sha: string; url: string }) => {
              const contentRes = await fetch(f.url, {
                headers: {
                  Authorization: `token ${t}`,
                  Accept: "application/vnd.github.v3+json",
                },
              });
              const contentData = await contentRes.json();
              const content = atob(contentData.content);
              
              // Parse frontmatter
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
                const categoryMatch = frontmatter.match(/category:\s*"?(.+?)"?\s*$/m);
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
      }
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
        `https://api.github.com/repos/CY-OPSS/teamfwlcons-website/contents/src/content/blog/zh/${slug}.md`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `feat: add blog post "${newPost.title}"`,
            content: btoa(unescape(encodeURIComponent(frontmatter))),
          }),
        }
      );

      if (res.ok) {
        setMessage("文章创建成功，正在自动部署...");
        setNewPost({ title: "", date: new Date().toISOString().split("T")[0], category: "新闻", content: "" });
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
        `https://api.github.com/repos/CY-OPSS/teamfwlcons-website/contents/src/content/blog/zh/${editing.slug}.md`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `update: edit blog post "${editing.title}"`,
            content: btoa(unescape(encodeURIComponent(frontmatter))),
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
      // First get the current file sha
      const fileRes = await fetch(
        `https://api.github.com/repos/CY-OPSS/teamfwlcons-website/contents/src/content/blog/zh/${post.slug}.md`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      const fileData = await fileRes.json();
      
      const res = await fetch(
        `https://api.github.com/repos/CY-OPSS/teamfwlcons-website/contents/src/content/blog/zh/${post.slug}.md`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
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
            <button onClick={() => setMessage("")} className="text-lg font-bold">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 文章列表 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">已有文章 ({posts.length})</h2>
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
                          {post.category && <span className="ml-2">• {post.category}</span>}
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

          {/* 编辑/创建文章 */}
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
      </div>
    </div>
  );
}
