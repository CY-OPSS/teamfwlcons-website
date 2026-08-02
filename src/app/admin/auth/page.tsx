"use client";

import { useEffect, useState } from "react";

export default function AuthPage() {
  const [status, setStatus] = useState("处理中...");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        // No code, redirect to GitHub
        const clientId = "Ov23litzSCwOJ4wdOt0N";
        const redirectUri = encodeURIComponent(
          `${window.location.origin}/admin/auth`
        );
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
        return;
      }

      try {
        // Exchange code for token
        const response = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (data.error) {
          setError(data.error_description || data.error);
          setStatus("授权失败");
          return;
        }

        // Send token to CMS
        const message = `authorization:github:success:${JSON.stringify({
          token: data.access_token,
          provider: "github",
        })}`;

        if (window.opener) {
          window.opener.postMessage(message, window.location.origin);
          setStatus("授权成功，正在关闭...");
          setTimeout(() => window.close(), 1000);
        } else {
          setStatus("授权成功！");
        }
      } catch (err) {
        setError("请求失败，请重试");
        setStatus("授权失败");
      }
    };

    handleAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">
          TeamFwlcons CMS 授权
        </h1>
        <div className="text-center">
          {error ? (
            <div className="text-red-600 mb-4">
              <p className="font-semibold">{status}</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          ) : (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
