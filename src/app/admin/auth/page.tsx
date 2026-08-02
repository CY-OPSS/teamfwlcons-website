"use client";

import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    // Handle the OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code) {
      // Exchange code for token
      fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token) {
            // Send token to CMS
            const message = `authorization:github:success:${JSON.stringify({
              token: data.access_token,
              provider: "github",
            })}`;
            if (window.opener) {
              window.opener.postMessage(message, window.location.origin);
              window.close();
            }
          }
        });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">正在授权...</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
}
