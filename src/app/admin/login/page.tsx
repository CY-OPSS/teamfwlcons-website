"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [token, setToken] = useState("");

  useEffect(() => {
    // Check if we have a token in the URL hash
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        // Store the token and redirect to CMS
        localStorage.setItem("decap-cms-user", JSON.stringify({
          token: accessToken,
          login: "CY-OPSS",
        }));
        window.location.href = "/admin/index.html#/";
      }
    }
  }, []);

  const handleLogin = () => {
    if (!token.trim()) return;
    
    // Save token in the format Decap CMS expects
    localStorage.setItem("decap-cms-user", JSON.stringify({
      token: token.trim(),
      login: "CY-OPSS",
    }));
    
    // Redirect to CMS
    window.location.href = "/admin/index.html#/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Team Fwlcons CMS
        </h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          请使用 GitHub Personal Access Token 登录
        </p>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            GitHub Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ghp_xxxxxxxxxxxx"
          />
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          登录
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs">
            如何获取 Token：
          </p>
          <ol className="text-gray-500 text-xs mt-2 text-left list-decimal list-inside space-y-1">
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
