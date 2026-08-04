"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";

type AuthUser = {
  id: string;
  username: string;
};

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const navItems = [
    { href: "/", label: "首页" },
    { href: "/blog", label: "博客" },
    { href: "/docs", label: "文档" },
    { href: "/team", label: "团队" },
    { href: "/about", label: "关于" },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-yellow-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">TF</span>
            </div>
            <span className="text-xl font-bold text-neutral-900">
              Team Fwlcons
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-neutral-600 hover:text-blue-600 transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <>
                <NotificationBell />
                <div className="hidden sm:flex items-center gap-3">
                  <span className="text-sm text-neutral-600">{user.username}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
                  >
                    退出
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                登录
              </Link>
            )}

            <button
              className="md:hidden p-2 rounded-md text-neutral-600 hover:bg-neutral-200"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-neutral-600 hover:text-blue-600 transition-colors font-medium px-2 py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-neutral-600 hover:text-blue-600 transition-colors font-medium px-2 py-1"
                >
                  退出（{user.username}）
                </button>
              ) : (
                <Link
                  href="/login"
                  className="text-neutral-600 hover:text-blue-600 transition-colors font-medium px-2 py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
