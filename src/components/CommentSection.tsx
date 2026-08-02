"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface CommentSectionProps {
  postSlug: string;
  locale?: string;
}

export function CommentSection({ postSlug, locale = "zh" }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(
          `/api/comments?postSlug=${postSlug}&locale=${locale}`
        );
        const data = await res.json();
        setComments(data);
      } catch {
        console.error("Failed to fetch comments");
      }
    };

    fetchComments();
  }, [postSlug, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user) return;

    setLoading(true);
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

      if (res.ok) {
        const comment = await res.json();
        setComments([comment, ...comments]);
        setNewComment("");
      }
    } catch {
      console.error("Failed to post comment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
      <h3 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
        评论 ({comments.length})
      </h3>

      {/* Comment Form */}
      {session?.user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="写下你的评论..."
            className="w-full p-4 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "提交中..." : "提交评论"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            请先登录后再评论
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="flex gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg"
          >
            <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0">
              {comment.user.image ? (
                <img
                  src={comment.user.image}
                  alt={comment.user.name || "User"}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {(comment.user.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-neutral-900 dark:text-white">
                  {comment.user.name || "Anonymous"}
                </span>
                <span className="text-sm text-neutral-500">
                  {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <p className="text-neutral-700 dark:text-neutral-300">
                {comment.content}
              </p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-center text-neutral-500 dark:text-neutral-400 py-8">
            暂无评论，快来发表第一条吧！
          </p>
        )}
      </div>
    </div>
  );
}
