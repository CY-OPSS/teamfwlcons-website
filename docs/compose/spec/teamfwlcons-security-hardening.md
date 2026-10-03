---
feature: Team Fwlcons 安全加固 · 第二阶段（后台内容代理）
status: implemented
updated: 2026-10-02
branch: feature/admin-server-proxy
---

# Team Fwlcons 安全加固 · 第二阶段

> 本文是给实现者（Cursor / Claude Code）执行的规格书。**第一阶段已完成并已落盘**，
> 其内容见文末附录，不要重做。本阶段只处理「残余风险」。

## Report

**背景** — 第一阶段修掉了 3 个高危问题（会话伪造、Deploy Hook 泄露、只读 Token 提权），
但后台的底层架构没变：**浏览器直连 GitHub Contents API**，因此 GitHub PAT 必然存在于页面里。

**本阶段目标** — 把 PAT 彻底移出浏览器，所有仓库读写改走服务端代理。

**当前验证状态** — `tsc --noEmit` 通过（仅剩 2 处 Prisma 客户端未生成的报错）；
`next build` 未在当前环境跑通（Turbopack 需拉起 worker 进程，被沙箱拒绝）。
**动手前请先在本机跑通一次 `npm run build` 并记录基线，否则无法判断回归。**

## [S1] Problem

| 编号 | 问题 | 现状 | 风险 |
|------|------|------|------|
| P1 | PAT 存在浏览器里 | 登录后存 `sessionStorage`，且**每次请求**都以 `Authorization` 发给 `api.github.com` 与自有 API | XSS 或共用电脑即可拿到一个**可写仓库**的凭据 |
| P2 | 权限边界过粗 | 能写仓库 = 全部管理能力 | 无法区分「改文章的人」与「删评论/看统计的人」 |
| P3 | 登录无频率限制 | `/api/auth/login` 首次登录即自动注册 | 可被暴力尝试口令 |
| P4 | 角色写入令牌且 30 天有效 | `role` 在 JWT 里 | 把某人降级后，旧令牌在有效期内仍是 ADMIN |
| P5 | Markdown 未消毒 | `src/lib/markdown.ts` 显式 `sanitize: false`，经 `dangerouslySetInnerHTML` 输出 | 能写仓库者可在站点注入脚本；与 P1 叠加后危害放大 |
| P6 | 死代码残留含同类漏洞 | `public/admin/index.html`、`src/app/admin/login/page.tsx` 仍把 PAT 写进 `localStorage`；Decap CMS 与 NextAuth 的 OAuth 路由已无人使用 | 多一条被遗忘的凭据落地路径 |
| P7 | 未使用的依赖 | `shiki`、`rehype-pretty-code` 全仓 0 引用；`next-auth` 仅被 `AuthProvider.tsx` 引用，而该组件自身无人引用 | 供应链与体积 |

## [S2] Design

### 架构概览

现状：

```
Browser ──(PAT: sessionStorage)──> api.github.com/repos/.../contents/*   ← 15 处直连
        └──(Bearer PAT)─────────> /api/admin/{comments,stats,deploy}
```

目标：

```
Browser ──(GitHub PAT，仅登录这一次)──> POST /api/admin/login
                                          └─ verifyGithubAdmin() 通过后
                                             下发站点 ADMIN 会话 Cookie，PAT 即丢弃

Browser ──(Cookie: tf_session, role=ADMIN)──> /api/admin/content/*  ──┐
                                            /api/admin/{comments,stats,deploy}
                                                                     │
                            服务端持有 GITHUB_CONTENT_TOKEN ──────────┘──> api.github.com
```

关键点：**PAT 只用于证明「你是谁」，不用于后续写入**。
后续所有仓库操作使用服务端环境变量里的细粒度 Token。

### 认证与会话

复用现有 `src/lib/session.ts` 的 JWT 会话机制，不引入新库。

- 后台登录成功时签发 `{ userId: "github:<login>", username: <login>, role: "ADMIN" }`。
  `userId` 用 `github:` 前缀，与数据库用户 id 区分开（cuid 不含冒号）。
- `verifySessionToken` 现有实现只校验 `userId`/`username` 是字符串，无需改动即可兼容。
- Cookie 名沿用 `tf_session`，与前台登录共用（管理员同时也是普通用户，不冲突）。

在 `src/lib/admin-auth.ts` 中新增：

```ts
export type AdminSession = { login: string };

/** 读取会话 Cookie，要求 role === "ADMIN"。返回 null 表示未授权。 */
export async function requireAdminSession(): Promise<AdminSession | null>;
```

`requireAdminSession` 要求：
1. 读取 `tf_session` Cookie（用 `src/lib/session.ts` 的 `getSession()`）。
2. `session.role === "ADMIN"`。
3. `session.userId` 以 `github:` 开头时取其后缀作为 login。
4. **若 `userId` 不以 `github:` 开头（即真实数据库用户），从数据库复查其 `role`**
   —— 这一步解决 P4：降级立即生效，不必等令牌过期。

保留现有 `verifyGithubAdmin(token)` 不变，它只用于登录那一次。

### 服务端 GitHub 客户端

新增 `src/lib/github-content.ts`，只允许服务端调用（不要 `"use client"`）：

```ts
const API = "https://api.github.com";

export function contentRepo(): string;          // process.env.ADMIN_REPO ?? 默认仓库
function token(): string;                        // process.env.GITHUB_CONTENT_TOKEN，缺失时抛错

export type ContentEntry = { name: string; path: string; sha: string; type: "file" | "dir"; size?: number };
export type ContentFile  = { path: string; sha: string; content: string; encoding: "utf-8" | "base64" };

export async function getEntry(path: string): Promise<ContentEntry[] | ContentFile>;
export async function putFile(input: {
  path: string; content: string; isBase64?: boolean; sha?: string; message?: string;
}): Promise<{ sha: string; commit: string }>;
export async function deleteFile(input: { path: string; sha: string; message?: string }): Promise<void>;
```

实现要点：

- **路径校验（必须做）**：`path` 必须匹配 `^(src/content|public/images)/` 且不含 `..`、
  不含前导 `/`、不含 `\`。白名单前缀写成常量，防止代理被用来改仓库任意文件。
- **409 冲突**：PUT 收到 409 时抛出带 `sha` 的类型化错误，让前端提示「内容已被他人修改，请刷新」。
- **大小上限**：PUT 的 `content` 超过 900 KB 直接拒绝（GitHub Contents API 有 1 MB 限制，
  头像那条约 800 px / JPEG 的既有压缩逻辑已经够用）。
- **超时**：所有 `fetch` 加 `AbortSignal.timeout(20_000)`。
- **错误信息**：不要把 GitHub 的响应体原样透传给浏览器（可能含内部信息），
  只回 `{ error: <简短中文> }`，详细信息 `console.error` 到服务端日志。

### 新增 API 契约

全部放在 `src/app/api/admin/` 下，**一律先 `await requireAdminSession()`，失败返回 401**。

| 方法 | 路径 | 请求 | 响应 |
|------|------|------|------|
| POST | `/api/admin/login` | `{ token: string }` | `200 { login }` + `Set-Cookie: tf_session`；失败 `401` |
| POST | `/api/admin/logout` | — | `200 { ok: true }` + 清 Cookie |
| GET | `/api/admin/session` | — | `200 { login }` 或 `401`（前端用来判断是否已登录） |
| GET | `/api/admin/content?path=<repoPath>` | — | 目录：`{ entries: ContentEntry[] }`；文件：`{ path, sha, content }` |
| PUT | `/api/admin/content` | `{ path, content, isBase64?, sha?, message? }` | `200 { sha }`；冲突 `409 { error, sha }` |
| DELETE | `/api/admin/content` | `{ path, sha, message? }` | `200 { ok: true }` |

同一批改动里把既有三个路由从 **Bearer PAT 改为会话 Cookie**：

- `src/app/api/admin/comments/route.ts`（GET / DELETE）
- `src/app/api/admin/stats/route.ts`（GET）
- `src/app/api/admin/deploy/route.ts`（POST）

把 `getBearerToken(request)` + `verifyGithubAdmin(token)` 换成 `requireAdminSession()`。
`getBearerToken` 在改造完成后若无引用即可删除。

### 前端改动映射

文件：`src/app/admin/page.tsx`（约 2060 行）。以下行号为**本次快照**，
动手前请用函数名重新定位。目标是把 `t: string`（PAT）参数从所有函数签名中移除。

| 现有位置 | 现有函数 | 现在直连的地址 | 改为 |
|----------|----------|----------------|------|
| L78 | `REPO` 常量 | — | 删除（移入服务端 `contentRepo()`） |
| L95–101 | `githubContentsUrl()` | 拼 `api.github.com` | 删除 |
| L250–256 | `useEffect` | 从 `sessionStorage` 取 token | 改 `GET /api/admin/session` |
| L258–267 | `bootstrap(t)` | 并发跑 6 个加载器 | 去掉参数 |
| L269–276 | `login()` | 存 `sessionStorage` | `POST /api/admin/login`，**不再存任何 token** |
| L278–290 | `logout()` | 清 `sessionStorage` | `POST /api/admin/logout` |
| L304–307 | `authHeaders(t)` | 组装 PAT 头 | 删除 |
| L309–313 | `loadPosts` | GET `contents/src/content/blog/zh` | GET `/api/admin/content?path=src/content/blog/zh` |
| L369 | `createPost` | PUT 文章 | PUT `/api/admin/content` |
| L424 | `updatePost` | PUT 文章 | 同上（带 `sha`） |
| L467 | `deletePost` | GET + DELETE | DELETE `/api/admin/content` |
| L503–506 | `loadDocs` | GET `contents/${DOCS_DIR}` | GET `/api/admin/content?path=src/content/docs/zh` |
| L572–588 | `createDoc` | PUT 文档 | PUT `/api/admin/content` |
| L621–625 | `updateDoc` | PUT 文档 | 同上 |
| L653–662 | `deleteDoc` | GET + DELETE | DELETE `/api/admin/content` |
| L689 | `importDocFile` | 读本地文件后走 createDoc | 不变，仅跟随 createDoc 改造 |
| L713–716 | `loadAbout` | GET `ABOUT_PATH` | GET `/api/admin/content?path=src/content/about/zh.json` |
| L750–758 | `saveAbout` | PUT | PUT `/api/admin/content` |
| L787–790 | `loadMembers` | GET `MEMBERS_PATH` | GET `/api/admin/content?path=src/content/team/members.yml` |
| L806–810 | `saveMembers` | PUT | PUT `/api/admin/content` |
| L884–912 | `uploadAvatar` | GET `?ref=main` + PUT 二进制 | GET 取 `sha`，PUT 时 `isBase64: true` |
| L944–945 | `uploadAvatar` 收尾 | PUT `members.yml` | PUT `/api/admin/content` |
| L974–976 | `loadComments` | `/api/admin/comments` + Bearer | 去掉 Bearer，靠 Cookie |
| L986–989 | `deleteComment` | 同上 | 去掉 Bearer |
| L1009–1011 | `loadStats` | `/api/admin/stats` + Bearer | 去掉 Bearer |
| L292–296 | `triggerDeploy` | `/api/admin/deploy` + Bearer | 去掉 Bearer |

另外：

- 登录框的文案「Token 需要 repo 权限」改为说明**登录用 Token 不会保存在浏览器**，
  并建议使用细粒度 Token。
- 全部 `fetch` 显式加 `credentials: "same-origin"`（同源默认已带，写上更明确）。
- 头像的 `fileToCompressedBase64()` 压缩逻辑**保持原样**，只把结果以 `isBase64: true` 发给代理。

### 环境变量

在 `.env.example` 与 Vercel 中补齐：

```
# 后台写入仓库用的细粒度 Token（仅服务端读取）
# 权限：Repository access = 仅 teamfwlcons-website
#       Permissions → Contents: Read and write
GITHUB_CONTENT_TOKEN=""

# 允许登录后台的 GitHub 用户名（逗号分隔）。留空 = 任何对该仓库有写权限者
ADMIN_GITHUB_USERS=""

# 内容仓库，默认 CY-OPSS/teamfwlcons-website
ADMIN_REPO="CY-OPSS/teamfwlcons-website"
```

### 需要删除的死代码（对应 P6、P7）

已核实（快照时）**没有任何文件引用它们**，其中两个仍在教用户把 PAT 存进 `localStorage`：

| 文件 | 说明 |
|------|------|
| `public/admin/index.html` | Decap CMS 外壳，内嵌 PAT 登录框并写入 `localStorage` |
| `public/admin/config.yml`、`public/config.yml` | Decap 配置 |
| `src/app/admin/login/page.tsx` | Decap 登录页，写 `localStorage`；第 20、35 行跳 `/admin/index.html#/` |
| `src/app/admin/auth/page.tsx` | 调 `/api/auth/token` 的 OAuth 回调页 |
| `src/app/api/auth/token/route.ts` | OAuth code 换 token |
| `src/app/api/auth/route.ts`、`src/app/api/auth/[...nextauth]/route.ts` | NextAuth OAuth 入口；`GITHUB_ID`/`GITHUB_SECRET` 为空，实际不可用 |
| `src/components/AuthProvider.tsx` | **只被自己引用**：全仓唯一 `import` `next-auth/react` 的地方 |

> 注意 `AuthProvider.tsx`：它是 `next-auth` 唯一的存活理由，且自身无人使用。
> 必须与 `next-auth` 一起删除，否则卸载依赖会导致编译失败。
> `/api/auth/[...nextauth]` 是 catch-all，但 Next.js 中静态段优先，
> 因此不会遮蔽 `/api/auth/{login,me,logout,register}`，删除是安全的。

动手前复核一次（应各自 0 命中，`AuthProvider` 只命中自身定义）：

```bash
grep -rn "admin/auth\|admin/login\|/admin/index.html" src
grep -rn "AuthProvider" src
grep -rn "next-auth" src          # 应只剩 AuthProvider.tsx 与 [...nextauth]/route.ts
grep -rn "shiki\|rehype-pretty-code\|@auth/prisma-adapter" src   # 应 0 命中
```

随后用 `git rm` 删除（保留可回溯性），再卸载依赖：

```bash
pnpm remove next-auth shiki rehype-pretty-code
```

`@auth/prisma-adapter` 当前在源码中 0 引用，但它与 `next-auth` 是否是同一套遗留请自行确认后
再决定是否一并移除（保守做法：本阶段先留着，不影响安全目标）。

## [S3] Out of Scope

- 不改前台（博客/文档/团队页）的视觉与路由。
- 不引入新的认证体系（OAuth、邮箱登录、2FA）。
- 不把内容从 Git 仓库迁到数据库。
- 不做多用户后台与细粒度角色（只区分 ADMIN / 非 ADMIN）。
- 不动 5E 战绩同步链路（`scripts/5e/` 与 GitHub Actions 保持现状）。
- 不修 Prisma 客户端生成问题（与环境有关，见 Report）。

## Tasks

- [x] T1: 新增 `src/lib/github-content.ts` 服务端客户端，含路径白名单校验、409 冲突处理、20s 超时、900 KB 上限 (covers: S2 服务端 GitHub 客户端)
- [x] T2: 在 `src/lib/admin-auth.ts` 增加 `requireAdminSession()`，并对非 `github:` 前缀的会话从数据库复查 role (covers: S2 认证与会话; 解决 P4)
- [x] T3: 新增 `POST /api/admin/login` / `POST /api/admin/logout` / `GET /api/admin/session` (covers: S2 新增 API 契约; depends: T2)
- [x] T4: 新增 `GET/PUT/DELETE /api/admin/content` (covers: S2 新增 API 契约; depends: T1, T2)
- [x] T5: 把 `/api/admin/{comments,stats,deploy}` 从 Bearer PAT 改为会话 Cookie，并删除无引用的 `getBearerToken` (covers: S2 新增 API 契约; depends: T2)
- [x] T6: 改造 `src/app/admin/page.tsx` —— 按映射表替换全部 15 处直连，移除 `t` 参数与 `sessionStorage` (covers: S2 前端改动映射; depends: T4, T5)
- [x] T7: 更新 `.env.example`（`GITHUB_CONTENT_TOKEN`、`ADMIN_GITHUB_USERS`、`ADMIN_REPO`）。Vercel 上的同名变量仍须人工填写 (covers: S2 环境变量; depends: T4)
- [x] T8: 删除死代码与未使用依赖 —— Decap 残留、NextAuth OAuth 路由、`AuthProvider.tsx`，再 `pnpm remove next-auth shiki rehype-pretty-code` (covers: S2 需要删除的死代码; 解决 P6, P7)
- [x] T9: 给 `/api/auth/login` 与 `/api/auth/register` 加频率限制（建议按 IP + 用户名计数，落在数据库表；Vercel 无状态，勿用内存变量） (解决 P3)
- [x] T10: Markdown 消毒 —— 去掉 `sanitize: false`，改为默认消毒并接入 `rehype-sanitize`，保留代码块高亮所需的白名单 (解决 P5)
- [x] T11: 回归验证与安全断言。`tsc`、`next build`、路径白名单、Markdown 消毒、未登录 401 已核对；登录后改文章与双标签 409 仍需人工点一次
- [x] T12: 执行密钥轮换（见附录第二节）。Deploy Hook、数据库密码、AUTH_SECRET、旧经典 Token、GITHUB_CONTENT_TOKEN 已轮换；细粒度 Token 于 2026-11-02 到期

依赖关系：T1→T4→T6；T2→T3/T4/T5；T8 可与 T6 并行；T12 独立但**越早越好**。

## 验收清单

自动化：

```bash
npx tsc --noEmit          # 应只剩 Prisma 那 2 条，或全绿
npm run build             # 必须通过，且路由表出现 /api/admin/login 与 /api/admin/content
grep -rn "api.github.com" src/app src/components   # 前台与后台组件应为 0 命中
grep -rn "localStorage\|sessionStorage" src/app/admin   # 应为 0 命中
grep -rn "GITHUB_CONTENT_TOKEN" src   # 只应出现在 github-content.ts
```

手工（逐条确认）：

1. 未登录访问 `GET /api/admin/content?path=src/content/team/members.yml` → **401**
2. 用普通用户会话（role=VISITOR）访问同一地址 → **401**
3. 用一个**只读** GitHub Token 调 `POST /api/admin/login` → **401**
4. 用合规 Token 登录 → 后台正常加载；浏览器 DevTools 里
   - `sessionStorage`/`localStorage` **搜不到任何 token**
   - Network 面板里**没有任何发往 `api.github.com` 的请求**
   - 请求头里只有 `tf_session` Cookie
5. 改一篇文章标题并保存 → 提示成功，Vercel 出现新部署（证明 deploy 代理仍工作）
6. 同一篇文章在两个标签页同时保存 → 第二个得到「内容已被他人修改」的 409 提示
7. `GET /api/admin/content?path=../../package.json` 与 `path=README.md` → 均 **400**（路径白名单生效）
8. 上传一张头像 → 成功，且 `public/images/team/<id>.jpg` 与 `members.yml` 都被更新

## 回滚方案

改动集中在新文件与 `src/app/admin/page.tsx`，且不涉及数据库迁移，因此：

- 整体回滚：`git revert` 或切回上一 tag 即可，无数据损失。
- 若只是代理出问题：把 `GITHUB_CONTENT_TOKEN` 撤销即可让写入失效（读仍可用），
  站点前台完全不受影响（前台只读 `src/content/**` 的文件，不经过本代理）。

---

## 附录

### 一、第一阶段已完成的改动（不要重做）

| 问题 | 文件 | 改动 |
|------|------|------|
| 会话可被伪造 | `src/lib/session.ts` | 生产环境缺 `AUTH_SECRET` 时抛错；密钥短于 32 位拒绝。原先会静默退回源码里写死的常量，导致任何人可自签 `role: "ADMIN"` |
| Deploy Hook 泄露 | `src/app/api/admin/deploy/route.ts`（新增）、`src/app/admin/page.tsx` | Hook 从 `VERCEL_DEPLOY_HOOK` 读取，改走服务端代理；原先硬编码在 `"use client"` 组件里，随 JS 下发到浏览器 |
| 只读 Token 即管理员 | `src/lib/admin-auth.ts` | 要求 `permissions.push === true`，并支持 `ADMIN_GITHUB_USERS` 白名单 |
| PAT 长期驻留 | `src/app/admin/page.tsx` | `localStorage` → `sessionStorage`（本阶段 T6 会彻底移除） |
| 未脱敏导出可被提交 | `.gitignore` | 忽略 `TeamFwlcons-cursor-chat-raw.jsonl`（内含明文数据库连接串） |
| 开放图片代理 | `next.config.ts` | 移除 `remotePatterns` 的 `hostname: "**"` 通配（项目未使用 `next/image`） |

详细说明与运行手册见 `docs/security.md`。

### 二、密钥轮换（T12，必须人工执行）

| 密钥 | 位置 | 备注 |
|------|------|------|
| Vercel Deploy Hook | Vercel → Settings → Git → Deploy Hooks：**删除旧 Hook**，新建后写入 `VERCEL_DEPLOY_HOOK` | 旧 Hook 已随 Git 历史公开，**删除旧的那一步才是止损** |
| Neon 数据库密码 | Neon → Roles → `neondb_owner` → Reset password，更新 Vercel 与 `.env.local` 的 `DATABASE_URL` | 口令在 `.env.local` 与对话导出里均为明文 |
| `AUTH_SECRET` | 生成 `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`，更新 Vercel 与 `.env.local`，`NEXTAUTH_SECRET` 一并换 | 副作用：所有人被登出一次 |
| GitHub PAT（旧后台用） | GitHub → Developer settings 撤销后重建 | 曾长期存在浏览器 `localStorage` |
| `GITHUB_CONTENT_TOKEN`（新） | 新建**细粒度** Token：Repository access 仅本仓库，Permissions → Contents: Read and write | 第一阶段不存在此项 |

### 三、已知环境问题（与本阶段无关，勿顺手改）

项目目录从 `TeamFwlcons网站` 改名为 `TeamFwlcons相关` 后，pnpm 建立的 2000 多个链接
全部指向旧路径，导致 `tsc`、`next` 无法解析。已用 `pnpm install --node-linker=hoisted`
重新安装修复。遗留：pnpm 默认拦截了 6 个包的构建脚本，需先执行
`pnpm approve-builds` 放行 `prisma`、`@prisma/engines` 等，否则 `tsc` 会持续报
`src/lib/prisma.ts` 与 `prisma/seed.ts` 的 `PrismaClient` 错误。
