"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    name: string | null;
    image: string | null;
  };
}

interface CommentSectionProps {
  postSlug: string;
  locale?: string;
}

type AuthUser = {
  id: string;
  username: string;
  role?: string;
};

export function CommentSection({
  postSlug,
  locale = "zh",
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, commentsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/comments?postSlug=${encodeURIComponent(postSlug)}&locale=${locale}`),
        ]);

        const meData = await meRes.json();
        setUser(meData.user ?? null);

        const commentsData = await commentsRes.json();
        if (Array.isArray(commentsData)) {
          setComments(commentsData);
        }
      } catch {
        setError("加载评论失败");
      }
    };

    load();
  }, [postSlug, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          postSlug,
          locale,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "发表失败");
        return;
      }

      setComments((prev) => [data, ...prev]);
      setNewComment("");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200">
      <h3 className="text-2xl font-semibold text-neutral-900 mb-6">
        评论 ({comments.length})
      </h3>

      {!user ? (
        <div className="mb-8 p-4 bg-neutral-50 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-neutral-600">请先登录后再评论（新用户将自动注册）</p>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center"
          >
            登录 / 注册
          </Link>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-neutral-600">
              以 <span className="font-semibold">{user.username}</span> 身份评论
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              退出登录
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="写下你的评论..."
              className="w-full p-4 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={loading || !newComment.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "发布中..." : "发表评论"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {comments.map((comment) => {
          const displayName =
            comment.user.username || comment.user.name || "匿名";
          return (
            <div
              key={comment.id}
              className="flex gap-4 p-4 bg-neutral-50 rounded-lg"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-neutral-900">
                    {displayName}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <p className="text-neutral-700">{comment.content}</p>
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-center text-neutral-500 py-8">
            暂无评论，快来发表第一条吧！
          </p>
        )}
      </div>
    </div>
  );
}
