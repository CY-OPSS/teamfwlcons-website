"use client";

import { useState, useEffect } from "react";

interface Post {
  slug: string;
  title: string;
  date: string;
  category: string;
  content: string;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [newPost, setNewPost] = useState<Post>({
    slug: "",
    title: "",
    date: new Date().toISOString().split("T")[0],
    category: "新闻",
    content: "",
  });
  const [message, setMessage] = useState("");

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
  };

  const loadPosts = async (t: string) => {
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
        const postList = data
          .filter((f: { name: string }) => f.name.endsWith(".md"))
          .map((f: { name: string }) => ({
            slug: f.name.replace(".md", ""),
            title: f.name.replace(".md", ""),
            date: "",
            category: "",
            content: "",
          }));
        setPosts(postList);
      }
    } catch {
      setMessage("加载文章失败");
    }
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
        setMessage("文章创建成功！");
        setNewPost({
          slug: "",
          title: "",
          date: new Date().toISOString().split("T")[0],
          category: "新闻",
          content: "",
        });
        loadPosts(token);
      } else {
        setMessage("创建失败，请检查 token 权限");
      }
    } catch {
      setMessage("创建失败，请重试");
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
            <a
              href="/"
              className="text-blue-600 hover:underline"
            >
              查看网站
            </a>
            <button
              onClick={logout}
              className="text-red-600 hover:underline"
            >
              退出
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {message && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
            {message}
            <button onClick={() => setMessage("")} className="float-right">
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 文章列表 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">已有文章</h2>
            {posts.length === 0 ? (
              <p className="text-gray-500">暂无文章</p>
            ) : (
              <ul className="space-y-2">
                {posts.map((post) => (
                  <li key={post.slug} className="p-3 bg-gray-50 rounded">
                    {post.slug}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 创建新文章 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">发布新文章</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  标题
                </label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) =>
                    setNewPost({ ...newPost, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="文章标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  日期
                </label>
                <input
                  type="date"
                  value={newPost.date}
                  onChange={(e) =>
                    setNewPost({ ...newPost, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  分类
                </label>
                <select
                  value={newPost.category}
                  onChange={(e) =>
                    setNewPost({ ...newPost, category: e.target.value })
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
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md h-48"
                  placeholder="文章内容，支持 Markdown 格式"
                />
              </div>
              <button
                onClick={createPost}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                发布文章
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
