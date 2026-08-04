"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  preview: string;
  postSlug: string;
  locale: string;
  read: boolean;
  createdAt: string;
  commentId: string;
  actor: {
    id: string;
    username: string;
    name: string | null;
  };
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await load();
    }
  };

  const markOneRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => undefined);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="消息通知"
        title="消息"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[1.1rem] text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">消息</h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || unreadCount === 0}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              全部已读
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-neutral-500">
                暂无消息
              </p>
            ) : (
              <ul>
                {items.map((item) => {
                  const actorName =
                    item.actor.username || item.actor.name || "有人";
                  const href = `/${item.locale}/blog/${item.postSlug}#comment-${item.commentId}`;
                  return (
                    <li key={item.id}>
                      <Link
                        href={href}
                        onClick={() => {
                          if (!item.read) markOneRead(item.id);
                          setOpen(false);
                        }}
                        className={`block px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 last:border-b-0 ${
                          item.read ? "bg-white" : "bg-blue-50/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm text-neutral-900">
                            <span className="font-medium">{actorName}</span>
                            <span className="text-neutral-600"> 回复了你</span>
                          </p>
                          <span className="shrink-0 text-[11px] text-neutral-400">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 line-clamp-2">
                          {item.preview}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
