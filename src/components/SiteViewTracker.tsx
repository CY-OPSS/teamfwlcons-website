"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks every public page visit for site-wide analytics.
 * Stores under the full pathname (e.g. /zh/team) so it doesn't collide
 * with blog post slugs used by ViewCounter.
 */
export function SiteViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    const locale = pathname.split("/")[1] || "zh";

    void fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: pathname, locale }),
    }).catch(() => {
      // ignore tracking errors
    });
  }, [pathname]);

  return null;
}
