# 安全加固说明与密钥轮换清单

更新时间：2026-10-03（第二轮修复）

**续期提醒：`GITHUB_CONTENT_TOKEN`（`teamfwlcons-content`）在 2026-11-02 到期。** 到期后后台保存文章、文档、成员和头像会失败，页面提示「仓库凭据失效，请联系管理员续期」。请在这一天之前到 GitHub 细粒度 Token 页面续期，并同时更新 Vercel 与本地 `.env.local`。

本文件记录一次安全排查的结论：**已改好的代码**、**你必须自己做的密钥轮换**，以及**尚未处理的残余风险**。

---

## 一、已修复（代码改动）

### 1. 会话签名密钥不再回退到公开常量 —— 严重

**原问题**：`src/lib/session.ts` 在 `AUTH_SECRET` 与 `NEXTAUTH_SECRET` 都未设置时，会退回到源码里写死的字符串
`dev-only-insecure-secret-change-me`。这个常量在仓库里人人可见，而会话令牌里带着 `role` 字段，
所以任何人只要自己签一个 `{"role":"ADMIN"}` 的 JWT 放进 `tf_session` Cookie，就能冒充管理员
（删评论、看统计）。更糟的是它「静默」降级：环境变量一旦漏配，站点照常运行，只是门锁换成了公用的。

**现在**：生产环境（`NODE_ENV=production`）下缺密钥直接抛错，拒绝签发和校验；密钥短于 32 字符也拒绝。
`verifySessionToken` 会捕获这个错误并返回 `null`，所以表现为「用户被登出」而不是站点崩溃——失败方向是安全的。
开发环境仍保留那个回退值，本地不受影响。

> 请确认 Vercel 的 Production 环境变量里 `AUTH_SECRET` 确实存在且长度 ≥ 32。
> 若缺失，部署后所有登录会立刻失效（这是预期行为，说明它确实在保护你）。

### 2. Vercel Deploy Hook 不再进入浏览器 —— 严重

**原问题**：`src/app/admin/page.tsx` 顶部写死了完整的 Deploy Hook 地址，
形如 `https://api.vercel.com/v1/integrations/deploy/prj_xxxx/xxxx`。
这个文件第一行是 `"use client"`，所以它被编译进浏览器 JS——
任何访客打开开发者工具都能读到这段 URL，然后无限次 POST 触发你的构建。
而且它已随提交进入 Git 历史。

**现在**：新增服务端路由 `POST /api/admin/deploy`，Hook 地址改从环境变量
`VERCEL_DEPLOY_HOOK` 读取，客户端只调用这个自有接口。浏览器里再也拿不到 Hook。

> ⚠️ **代码改完还不够**：旧 Hook 地址已经公开过，必须去 Vercel 把它**删除**并新建一个。
> 详见下面第二节第 1 条。

### 3. 后台鉴权不再「能读仓库就是管理员」 —— 高

**原问题**：`src/lib/admin-auth.ts` 只请求 `GET /repos/{repo}`，看到 `res.ok` 就放行。
而读仓库权限是最低的权限等级——只读 Token、甚至一个只能读公开仓库的 Token 都能通过，
进而解锁删除评论、查看统计等管理能力。

**现在**：要求 Token 对仓库具备**写权限**（`permissions.push === true`），
并且额外调用 `GET /user` 确认 Token 归属。同时支持可选的账号白名单：

```
ADMIN_GITHUB_USERS="CY-OPSS,facwink"   # 逗号分隔，留空 = 任何有写权限的账号
```

留空是默认值，避免你自己被挡在门外；建议填上。

### 4. 后台 Token 不再进入浏览器 —— 高

登录只在 `POST /api/admin/login` 用一次 GitHub PAT 证明身份，通过后立刻丢弃，
改发站点自己的 `tf_session` Cookie。之后文章、文档、关于页、成员、头像的读写
都走 `GET/PUT/DELETE /api/admin/content`，由服务端环境变量 `GITHUB_CONTENT_TOKEN`
调用 GitHub。评论、统计、部署同样只认这个 Cookie，不再接受 `Authorization: Bearer`。

路径被限制在 `src/content/` 与 `public/images/`，不能用 `..` 改仓库里的其他文件。
两人同时保存同一篇时，后保存的一方会收到「内容已被他人修改，请刷新」。

Markdown 渲染已接上 `rehype-sanitize`，不再使用 `sanitize: false`。
前台登录和注册按 IP + 用户名做了 15 分钟 8 次的失败次数限制，同一 IP 另有 15 分钟 30 次的总上限（存在数据库表 `AuthAttempt`）。
数据库用户的管理员身份每次请求都会回表核对，降级不用等令牌过期。

### 5. 去掉图片优化器的通配白名单 —— 低

`next.config.ts` 里原本是 `remotePatterns: [{ hostname: "**" }]`，
等于把 `/_next/image` 变成可以代理任意远程 URL 的开放代理。项目里实际用的是原生 `<img>`，
没有任何 `next/image` 调用，所以这行是纯粹的多余暴露面，已移除。

### 6. 未脱敏的对话导出加入 .gitignore —— 中

`TeamFwlcons-cursor-chat-raw.jsonl` 里含**明文** Neon 连接串、
Deploy Hook 路径等信息（同目录的 `.md` 版本已脱敏，这个原始版没有）。
它此前处于「未提交但也未被忽略」的状态，一次 `git add -A` 就会把它连同密钥推上去。
现已加入 `.gitignore`。

---

## 二、你必须自己做的（代码改不了的部分）

2026-10-03 已完成轮换：旧 Deploy Hook 已删、数据库密码已重置、`AUTH_SECRET` / `NEXTAUTH_SECRET` 已换、旧经典 Token 已撤销、`GITHUB_CONTENT_TOKEN` 已写入 Vercel 与 `.env.local`。`AuthAttempt` 表已在 Neon。下面留作对照，不必再做一遍。尚未生效的是：这些代码改动还没提交，`ADMIN_GITHUB_USERS=CY-OPSS` 要等下一次部署才进生产。

### 1. 删除并重建 Vercel Deploy Hook（最紧急）

因为它已经公开在 Git 历史和浏览器 JS 里。

1. Vercel → 项目 `teamfwlcons-website` → **Settings → Git → Deploy Hooks**
2. 找到旧 Hook，点 **Delete**（这一步才是真正止损：旧 URL 从此失效）
3. **Create Hook**，名称随意（如 `admin-panel`），分支填 `main`，复制新 URL
4. Vercel → **Settings → Environment Variables** → 新增 `VERCEL_DEPLOY_HOOK`，粘贴新 URL（Production 环境）
5. 本地 `.env.local` 里也补一份，方便本地调试
6. 重新部署一次使环境变量生效

### 2. 重置 Neon 数据库密码

`neondb_owner` 的口令 `npg_...` 在 `.env.local` 和那个 jsonl 里都是明文。

1. Neon 控制台 → 项目 → **Roles** → `neondb_owner` → **Reset password**
2. 复制新的连接串
3. 更新到两处：Vercel 的 `DATABASE_URL`、本地 `.env.local` 的 `DATABASE_URL`
4. 重新部署

### 3. 更换 AUTH_SECRET

1. 生成一串新的：
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. 同时更新 Vercel 的 `AUTH_SECRET` 和 `NEXTAUTH_SECRET`（代码里两者取其一，都填上更省心）
3. 更新本地 `.env.local`
4. 副作用：**所有人会被登出**，需要重新登录一次。这是正常的

### 4. 撤销旧 GitHub PAT，并新建服务端写入 Token

旧 Token 曾经长期存在浏览器 `localStorage` / `sessionStorage` 里，应撤销。

1. GitHub → Settings → Developer settings：撤销以前用来登录后台的 PAT
2. 新建一个**细粒度** Token，只给服务端用，填进 Vercel 与本地 `.env.local` 的 `GITHUB_CONTENT_TOKEN`：
   - Repository access：仅 `CY-OPSS/teamfwlcons-website`
   - Permissions：`Contents: Read and write`
3. 登录后台时仍要填一个能写本仓库的 Token，但它只用来证明身份，不会被保存。
   建议这个登录 Token 也做成细粒度，并视需要设置 `ADMIN_GITHUB_USERS`
4. 部署后执行一次 `pnpm exec prisma db push`，让登录限流表 `AuthAttempt` 出现在 Neon 里

---

## 三、残余风险

| 项 | 说明 | 建议 |
|---|---|---|
| 登录瞬间仍要提交一次 PAT | 只用于 `POST /api/admin/login` 证明身份，响应后即丢弃，不再写入 `localStorage` / `sessionStorage` | 用完即弃；真正写入仓库的是服务端 `GITHUB_CONTENT_TOKEN` |
| `/admin` 无服务端守卫 | 它只是个登录壳，不登录拿不到任何数据；页面本身不需要认证即可加载 | 风险低，可接受 |
| 前台首次登录仍会自动注册 | 限流只拦住同一 IP + 用户名在 15 分钟内超过 8 次失败 | 不改注册规则 |
| GitHub 身份的 ADMIN 写在令牌里 | 白名单 `ADMIN_GITHUB_USERS` 有值时，每次请求都会核对；把用户名移出后，已签发的会话立刻失效。白名单为空时仍信任令牌，直到过期 | 已填 `CY-OPSS`。改名单后要重新部署才生效 |
| 登录限流 | 优先相信 `x-vercel-forwarded-for`，其次 `x-real-ip`，最后才用 `x-forwarded-for` 的末段。同一用户名 15 分钟 8 次，同一 IP 15 分钟 30 次 | 过期记录约每 50 次请求清一次 |
| 香港镜像 | 已放弃。实例若已释放则无需再操作 | — |

---

## 四、改完后的自检

```bash
pnpm exec tsc --noEmit
pnpm build
```

### 本次验证结果与已知环境限制

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 通过（已执行 `prisma generate`） |
| `pnpm build` | 通过。路由表含 `/api/admin/login`、`/api/admin/content` |
| `prisma db push` | 已同步，`AuthAttempt` 表已在 Neon |

### node_modules 曾被整体损坏（已修复）

本项目目录从 `TeamFwlcons网站` 改名为 `TeamFwlcons相关` 后，pnpm 建立的
2000 多个链接仍指向旧路径，导致 `tsc`、`next` 等全部无法解析。已重新安装修复，
并采用 `--node-linker=hoisted`（扁平布局，避开一个 pnpm 符号链接崩溃问题）。

有一条遗留事项需要你执行：

```bash
pnpm approve-builds
```

pnpm 默认拦截了 6 个包的构建脚本（`@prisma/engines`、`prisma`、`@swc/core`、
`sharp`、`@parcel/watcher`、`unrs-resolver`）。不放行的话 `prisma generate` 会失败，
`tsc` 会一直报那 2 处 `PrismaClient` 错误。放行后重新生成一次即可：

```bash
npx prisma generate
```

然后手动验证：

1. 不登录访问 `GET /api/admin/content?path=src/content/team/members.yml` → 401
2. 用普通用户会话访问同一地址 → 401
3. 用只读 GitHub Token 调 `POST /api/admin/login` → 401
4. 用有写权限的 Token 登录后：浏览器里搜不到 token，也没有发往 `api.github.com` 的请求
5. 改一篇文章并保存 → 成功，且 Vercel 出现新部署
6. `path=../../package.json` 与 `path=README.md` → 均 400
