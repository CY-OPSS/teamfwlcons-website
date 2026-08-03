"use client";

import { useState, useEffect } from "react";

interface Comment {
  id: string;
  content: string;
  username: string;
  createdAt: string;
}

interface CommentSectionProps {
  postSlug: string;
}

export function CommentSection({ postSlug }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("comment_username");
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
    }

    const savedComments = localStorage.getItem(`comments_${postSlug}`);
    if (savedComments) {
      setComments(JSON.parse(savedComments));
    }
  }, [postSlug]);

  const handleLogin = () => {
    if (username.trim().length < 2) {
      alert("用户名至少2个字符");
      return;
    }
    localStorage.setItem("comment_username", username.trim());
    setIsLoggedIn(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isLoggedIn) return;

    const comment: Comment = {
      id: Date.now().toString(),
      content: newComment.trim(),
      username: username.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [comment, ...comments];
    setComments(updatedComments);
    localStorage.setItem(`comments_${postSlug}`, JSON.stringify(updatedComments));
    setNewComment("");
  };

  const handleLogout = () => {
    localStorage.removeItem("comment_username");
    setIsLoggedIn(false);
    setUsername("");
  };

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200">
      <h3 className="text-2xl font-semibold text-neutral-900 mb-6">
        评论 ({comments.length})
      </h3>

      {/* Login / Comment Form */}
      {!isLoggedIn ? (
        <div className="mb-8 p-4 bg-neutral-50 rounded-lg">
          <p className="text-neutral-600 mb-3">输入用户名即可评论</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="请输入用户名"
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              确认
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-neutral-600">
              以 <span className="font-semibold">{username}</span> 身份评论
            </p>
            <button
              onClick={handleLogout}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              切换用户
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
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                发表评论
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="flex gap-4 p-4 bg-neutral-50 rounded-lg"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">
                {comment.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-neutral-900">
                  {comment.username}
                </span>
                <span className="text-sm text-neutral-500">
                  {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <p className="text-neutral-700">{comment.content}</p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-center text-neutral-500 py-8">
            暂无评论，快来发表第一条吧！
          </p>
        )}
      </div>
    </div>
  );
}
