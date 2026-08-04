"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface CommentUser {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId?: string;
  parentId?: string | null;
  user: CommentUser;
  replies?: Comment[];
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

function displayName(user: CommentUser) {
  return user.username || user.name || "匿名";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentSection({
  postSlug,
  locale = "zh",
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const totalCount = useMemo(
    () =>
      comments.reduce(
        (sum, comment) => sum + 1 + (comment.replies?.length ?? 0),
        0
      ),
    [comments]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, commentsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(
            `/api/comments?postSlug=${encodeURIComponent(postSlug)}&locale=${locale}`
          ),
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

  const canDelete = (comment: Comment) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    return comment.user?.id === user.id || comment.userId === user.id;
  };

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

      setComments((prev) => [{ ...data, replies: data.replies ?? [] }, ...prev]);
      setNewComment("");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTo || !replyContent.trim() || !user) return;

    setReplyLoading(true);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent,
          postSlug,
          locale,
          parentId: replyTo.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "回复失败");
        return;
      }

      const rootId = replyTo.parentId ?? replyTo.id;
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id !== rootId) return comment;
          return {
            ...comment,
            replies: [...(comment.replies ?? []), data],
          };
        })
      );
      setReplyContent("");
      setReplyTo(null);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleDelete = async (comment: Comment) => {
    if (!user || !canDelete(comment)) return;
    if (!window.confirm("确定删除这条评论吗？删除后不可恢复。")) return;

    setDeletingId(comment.id);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "删除失败");
        return;
      }

      setComments((prev) => {
        if (!comment.parentId) {
          return prev.filter((item) => item.id !== comment.id);
        }
        return prev.map((item) => {
          if (item.id !== comment.parentId) return item;
          return {
            ...item,
            replies: (item.replies ?? []).filter((r) => r.id !== comment.id),
          };
        });
      });

      if (replyTo?.id === comment.id) {
        setReplyTo(null);
        setReplyContent("");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setReplyTo(null);
  };

  const renderActions = (comment: Comment) => (
    <div className="mt-2 flex items-center gap-3 text-sm">
      {user ? (
        <button
          type="button"
          onClick={() => {
            setReplyTo(comment);
            setReplyContent("");
            setError("");
          }}
          className="text-blue-600 hover:text-blue-700"
        >
          回复
        </button>
      ) : (
        <Link href="/login" className="text-blue-600 hover:text-blue-700">
          登录后回复
        </Link>
      )}
      {canDelete(comment) && (
        <button
          type="button"
          onClick={() => handleDelete(comment)}
          disabled={deletingId === comment.id}
          className="text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {deletingId === comment.id ? "删除中..." : "删除"}
        </button>
      )}
    </div>
  );

  const renderReplyEditor = (anchorId: string) => {
    if (!replyTo || (replyTo.parentId ?? replyTo.id) !== anchorId) return null;
    if (!user) return null;

    return (
      <form onSubmit={handleReply} className="mt-3">
        <p className="mb-2 text-sm text-neutral-500">
          回复 @{displayName(replyTo.user)}
        </p>
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="写下你的回复..."
          className="w-full p-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setReplyTo(null);
              setReplyContent("");
            }}
            className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={replyLoading || !replyContent.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {replyLoading ? "发送中..." : "发送回复"}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200">
      <h3 className="text-2xl font-semibold text-neutral-900 mb-6">
        评论 ({totalCount})
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

      {error && user && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-6">
        {comments.map((comment) => {
          const name = displayName(comment.user);
          return (
            <div
              id={`comment-${comment.id}`}
              key={comment.id}
              className="flex gap-4 p-4 bg-neutral-50 rounded-lg scroll-mt-24"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-neutral-900">{name}</span>
                  <span className="text-sm text-neutral-500">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-neutral-700 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
                {renderActions(comment)}
                {renderReplyEditor(comment.id)}

                {(comment.replies?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-4 border-l border-neutral-200 pl-4">
                    {comment.replies!.map((reply) => {
                      const replyName = displayName(reply.user);
                      return (
                        <div
                          id={`comment-${reply.id}`}
                          key={reply.id}
                          className="flex gap-3 scroll-mt-24"
                        >
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-blue-600">
                              {replyName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-neutral-900">
                                {replyName}
                              </span>
                              <span className="text-sm text-neutral-500">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-neutral-700 whitespace-pre-wrap break-words">
                              {reply.content}
                            </p>
                            {renderActions(reply)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
