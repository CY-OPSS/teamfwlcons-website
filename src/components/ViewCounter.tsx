"use client";

import { useState, useEffect } from "react";

interface ViewCounterProps {
  slug: string;
  locale?: string;
}

export function ViewCounter({ slug, locale = "zh" }: ViewCounterProps) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    const updateViews = async () => {
      try {
        const res = await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, locale }),
        });
        const data = await res.json();
        if (data && typeof data.views === "number") {
          setViews(data.views);
        } else {
          setViews(0);
        }
      } catch {
        setViews(0);
      }
    };

    updateViews();
  }, [slug, locale]);

  if (views === null) {
    return (
      <span className="text-sm text-neutral-400">...</span>
    );
  }

  return (
    <span className="text-sm text-neutral-500">
      {views.toLocaleString()} 次浏览
    </span>
  );
}
