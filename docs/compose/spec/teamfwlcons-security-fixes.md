---
feature: Team Fwlcons 安全加固 · 第二轮修复清单
status: code-fixed
updated: 2026-10-03
branch: feature/admin-server-proxy
---

# 修复清单（第二轮）

来源：对第一阶段实现的静态审查（沙箱内无法跑 git / build，未做真机验证）。
**实现本身与计划吻合**，下面的项都是审查新发现或计划未覆盖的。已通过的部分见文末附录，不要重做。

严重度：**阻断** > 高 > 中 > 低。

---

## A. 部署前必做（阻断，必须由人执行）

- [x] **A1 · 给生产库建 `AuthAttempt` 表**（已存在，0 行，未再跑 `db push`）

  审查发现：`AuthAttempt` 是本次新增的表，但项目没有 `prisma/migrations` 目录（一直靠手工 `db push`），
  而 `vercel.json` 的 buildCommand 只有 `prisma generate && next build`，**不会建表**。

  后果：`src/lib/rate-limit.ts` 的 `tooManyAttempts()` 是登录与注册的第一个动作，内部直接
  `prisma.authAttempt.deleteMany(...)`。表不存在会抛错，被路由的 `try/catch` 转成 500 ——
  这份代码一上线，**所有登录和注册全部失败**。

  执行（二选一）：

  ```bash
  # 方式一：用生产 DATABASE_URL 跑 db push（推荐）
  npx prisma db push
  ```

  ```sql
  -- 方式二：在 Neon SQL Editor 手工建表
  -- 只新增一张表，属于纯追加，不会动现有数据
  CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX "AuthAttempt_key_createdAt_idx" ON "AuthAttempt"("key", "createdAt");
  ```

  > `db push` 若提示「可能丢失数据」，**停下来确认**，不要一路回车。
  > 只应看到「新增表 AuthAttempt」这一类变更。

- [ ] **A2 · 弄清 e9497c2 再提交**

  已 `git fetch`：`e9497c2` 在 `origin/main` 上，提交说明是 `chore: sync 5E display stats`。
  本地 `main` 仍是 `289596e`，落后 `origin/main`（`4fc6f45`）138 个提交，差异只有 `src/content/stats/5e.json`。
  **还没合并、也还没提交**，避免把安全改动强推上去。提交前先 merge `origin/main`。

  本地 `refs/heads/main` 与 `origin/main` 都停在 `289596ef`（8 月 29 日），
  而线上部署的是 `e9497c2`。该提交在本地仓库中不存在（无 packed-refs、无松对象，
  最后一次 fetch 是 `9c94055`）。

  ```bash
  git fetch origin
  git log --oneline origin/main -5        # 看清 e9497c2 是什么
  git log --oneline 289596ef..origin/main # 有没有你不认识的改动
  ```

  若 origin/main 已前进：把当前工作 rebase/merge 到它上面再提交。
  **不要强推** —— 会丢掉那个提交。

- [x] **A3 · 设置 `ADMIN_GITHUB_USERS`**（值已写入本地 `.env.local` 与 Vercel Production / Preview / Development：`CY-OPSS`）

  变量要到**这次新代码的部署**才会进生产进程。在那之前，线上仍是旧版本，白名单和 B2 的即时踢人都还没生效。

  当前为空 = 任何对该仓库有写权限的 Token 都能登录后台。
  填入你的 GitHub 用户名（逗号分隔，同时更新 Vercel 与本地 `.env.local`）：

  ```
  ADMIN_GITHUB_USERS="CY-OPSS"
  ```

  这一步同时启用 B2 的「即时踢人」能力。

---

## B. 代码修复

### 高

- [x] **B1 · 限流 IP 可被伪造**
  - 位置：`src/lib/rate-limit.ts` 的 `attemptKey()`（约 6–13 行）
  - 现状：取 `x-forwarded-for` 的**第一段**。客户端可自带该请求头，每次换一个假 IP
    即可绕过 8 次上限。
  - 改法：按可信度依次取值

    ```ts
    function clientIp(request: Request) {
      const vercel = request.headers.get("x-vercel-forwarded-for");
      if (vercel) return vercel.split(",")[0].trim();
      const real = request.headers.get("x-real-ip");
      if (real) return real.trim();
      const forwarded = request.headers.get("x-forwarded-for") || "";
      const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
      return hops[hops.length - 1] || "unknown";   // 末段，而非首段
    }
    ```

  - 验收：伪造 `x-forwarded-for: 1.2.3.4` 连续请求 9 次，第 9 次仍应返回 429。

### 中

- [x] **B2 · `github:` 会话无法撤销（30 天）**
  - 位置：`src/lib/admin-auth.ts` 的 `requireAdminSession()`（约 78–98 行）
  - 现状：`userId` 以 `github:` 开头时直接信任，不查任何东西。因此在 JWT 有效期内
    （30 天），把某人移出白名单或吊销细粒度 Token 都**不会**让已签发的会话失效。
  - 改法：在该分支里比对当前白名单（白名单为空时保持现状，避免误锁）

    ```ts
    if (session.userId.startsWith("github:")) {
      const login = session.userId.slice("github:".length);
      if (!login) return null;
      const allow = allowedLogins();          // 复用同一个函数
      if (allow.length > 0 && !allow.includes(login)) return null;
      return { login };
    }
    ```

  - 验收：登录后台 → 把该用户名从 `ADMIN_GITHUB_USERS` 移除 → 刷新后台应立刻 401。

- [x] **B3 · 细粒度 Token 到期时报错不可辨识**
  - 位置：`src/lib/github-content.ts` 的 `github()`（约 63–77 行）
  - 背景：`GITHUB_CONTENT_TOKEN` 到期日 **2026-11-02**。到期后 GitHub 返回 401/403，
    但现在只被归成通用的「写入仓库失败 / 读取仓库失败」，排查时难以一眼定位。
  - 改法：新增 `ContentAuthError`，在 `getEntry` / `putFile` / `deleteFile` 里
    对 `res.status === 401 || res.status === 403` 抛出它；
    在 `src/app/api/admin/content/route.ts` 的 `fail()` 里映射为
    `502 { error: "仓库凭据失效，请联系管理员续期" }`。
  - 验收：临时把 `GITHUB_CONTENT_TOKEN` 改成无效值，后台保存应显示上述文案而非通用报错。
  - **另外：现在就给 2026-11-02 设一个续期提醒。**

### 低

- [x] **B4 · 每次请求都做全表清理，且索引不匹配**（改为约 1/50 的请求才清理，未加新索引，因此不用再 `db push`）
  - 位置：`src/lib/rate-limit.ts` 的 `tooManyAttempts()`（约 15–24 行）
  - 现状：每次登录都执行 `deleteMany({ createdAt: { lt: ... } })`，
    而索引 `[key, createdAt]` 覆盖不到仅按 `createdAt` 的过滤 → 每次都全表扫描。
  - 改法：任选其一
    - 给 `AuthAttempt` 加 `@@index([createdAt])`（需再跑一次 `db push`）；或
    - 把清理改成概率触发，例如约 1/50 的请求才执行。

- [x] **B5 · 限流键可被密码喷洒绕过**
  - 位置：同上，`attemptKey()` 返回 `${ip}:${username}`
  - 现状：同一 IP 可对大量不同用户名各试 8 次。
  - 改法：除现有键外，再按 **纯 IP** 记一条，并设更宽的全局上限（如 15 分钟 30 次）。
    最小改动：`recordAttempt()` 里同时写入 `${ip}:*` 这类哨兵键，检查时一并计数。

- [x] **B6 · 二进制文件被按 utf8 解码**
  - 位置：`src/lib/github-content.ts` 的 `getEntry()`（约 110–118 行）
  - 现状：`Buffer.from(raw, "base64").toString("utf8")` 对头像等二进制会产生乱码字符串，
    而调用方（`uploadAvatar`，`src/app/admin/page.tsx` 约 807–814 行）**只需要 `sha`**。
  - 改法：当路径以 `public/images/` 开头时，`content` 原样返回 base64，
    并把 `ContentFile.encoding` 放宽为 `"utf-8" | "base64"`。

- [x] **B7 · 卸载死依赖**
  - `@auth/prisma-adapter` 在 `next-auth` 移除后已无任何引用。
  - `pnpm remove @auth/prisma-adapter`

---

## C. 部署后验收（逐条勾）

先决条件：A1 已执行，并且 **这次改动已经部署**（含 B 组代码，且该次部署读到了 `ADMIN_GITHUB_USERS`）。

C4 及之后（C4–C12）只在这个新部署上做。不要在当前旧版本的线上环境里勾。旧版本没有这轮后台代理，也还没用上白名单。

- [ ] C1 用一个普通账号登录前台 → **成功**（验证 A1 生效：表存在）
- [ ] C2 新注册一个账号 → **成功**
- [ ] C3 连续输错密码 9 次 → 第 9 次返回 **429**
- [ ] C4 用 PAT 登录后台 → 成功；DevTools 中 `localStorage` / `sessionStorage`
      **搜不到任何 token**
- [ ] C5 后台 Network 面板中 **没有任何发往 `api.github.com` 的请求**，
      请求头里只有 `tf_session` Cookie
- [ ] C6 改一篇文章标题并保存 → 提示成功，Vercel 出现新部署
- [ ] C7 上传一张头像 → 成功，`public/images/team/<id>.<ext>` 与 `members.yml` 均更新
- [ ] C8 未登录访问 `/api/admin/content?path=src/content/team/members.yml` → **401**
- [ ] C9 访问 `/api/admin/content?path=../../package.json` → **400**
- [ ] C10 访问 `/api/admin/content?path=README.md` → **400**（前缀白名单）
- [ ] C11 文章正文里的代码块仍有高亮 class（验证 `rehype-sanitize` 的 className 白名单够用）
- [ ] C12 打开一篇旧文章，确认消毒没有吃掉原本正常的内嵌 HTML
      —— **这是本次唯一可能影响观感的改动**，若被吃掉需在 `src/lib/markdown.ts`
      的 schema 里补白名单

---

## D. 附录：审查已确认通过（不要重做）

| 项 | 结论 |
|---|---|
| 路径穿越防护 | 四道检查齐全；逐段 `encodeURIComponent` 是真正的兜底，双重编码无法绕过 |
| `github:` 前缀可否伪造 | 不可。`userId` 来自签名 JWT，数据库用户 id 是 cuid、不含冒号 |
| 后台直连 `api.github.com` | 0 命中 |
| 后台 `localStorage` / `sessionStorage` | 0 命中；登录成功后 `setToken("")` 清空 |
| `GITHUB_CONTENT_TOKEN` 出现位置 | 只在 `src/lib/github-content.ts` |
| 残留 `Authorization` / `Bearer` | 只在服务端 lib |
| 死代码清理 | 9 个文件全部删除（含 `AuthProvider.tsx`） |
| 依赖卸载 | `next-auth` / `shiki` / `rehype-pretty-code` / `remark-html` 已移除 |
| Markdown 消毒 | `remark-rehype → rehype-sanitize → rehype-stringify`，className 白名单已补 |
| 数据库角色复查 | 非 `github:` 会话会查库校验 `role`，降级即时生效 |
| 后台 15 处调用点 | 全部改走 `/api/admin/content`；头像 `isBase64: true`；409 用服务端文案 |
| `.env.example` | 合法 UTF-8，四个新变量均已记录 |
| 既有管理路由 | comments / stats / deploy 已统一改为 `requireAdminSession()` |
