"use client";

import { useState } from "react";

export default function AuthPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError("请输入 GitHub Personal Access Token");
      return;
    }

    // Send token to CMS
    const message = `authorization:github:success:${JSON.stringify({
      token: token.trim(),
      provider: "github",
    })}`;

    if (window.opener) {
      window.opener.postMessage(message, window.location.origin);
      window.close();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">
          TeamFwlcons CMS 登录
        </h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          请使用 GitHub Personal Access Token 登录
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ghp_xxxxxxxxxxxx"
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            登录
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs">
            如何获取 Token：
          </p>
          <ol className="text-gray-500 text-xs mt-2 text-left list-decimal list-inside">
            <li>访问 GitHub Settings → Developer settings → Personal access tokens</li>
            <li>点击 &quot;Generate new token (classic)&quot;</li>
            <li>选择 &quot;repo&quot; 权限</li>
            <li>复制生成的 token</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
