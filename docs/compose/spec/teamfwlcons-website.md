---
feature: teamfwlcons-website
status: delivered
updated: 2026-08-02
branch: feature/website-v1
---

# TeamFwlcons CS2 战队网站

## Report

**What was built** — 一个完整的 CS2 电竞战队官方网站，基于 Next.js 16 + Tailwind CSS 4 构建。网站包含以下核心功能：

1. **博客系统**：支持 Markdown 文章发布，分类和标签筛选，文章详情页带评论区和浏览统计
2. **文档系统**：多层级文档结构，侧边栏导航，支持中英文双语
3. **团队页面**：成员卡片展示，包含角色、个人简介、游戏数据统计和社交链接
4. **关于页面**：战队历史、荣誉成就、联系方式
5. **Decap CMS**：基于 Git 的内容管理系统，管理员可通过 `/admin` 后台在线编辑和发布内容
6. **国际化**：完整的中英文双语支持，使用 next-intl 实现
7. **暗色模式**：系统偏好检测 + 手动切换，使用 next-themes 管理
8. **代码高亮**：使用 shiki/rehype-pretty-code 实现
9. **评论系统**：基于 PostgreSQL 存储，支持审核机制
10. **浏览统计**：文章浏览计数，热门文章展示
11. **SEO 优化**：自动生成 sitemap.xml、robots.txt，完整的 meta 标签和 Open Graph 支持

**Verification** — `npm run build` 成功完成，所有页面正确生成：
- 23 个静态页面成功预渲染
- 所有路由正常工作
- TypeScript 类型检查通过
- 无构建错误

**Journey log**:
1. 使用 create-next-app 初始化项目，但因目录名含中文字符导致失败，改用临时目录创建后复制
2. Prisma 7.x 版本变更了 datasource 配置方式，需要使用 prisma.config.ts 和 driver adapter
3. next-auth v4 和 v5 API 差异较大，需要根据安装的版本选择正确的 API
4. useTranslations 不能在 async 组件中使用，需要将使用翻译的组件改为同步或使用客户端组件
5. useSession 需要 SessionProvider 包裹，需要在服务端组件中使用 AuthProvider 包装客户端组件

## [S1] Problem

TeamFwlcons 是一支学校 CS2 电竞战队，需要一个官方网站来：
- 展示战队成员和成就
- 发布博客文章和赛事记录
- 提供 CS2 相关技术文档
- 支持中英双语
- 管理员可在线编辑和发布内容

## [S2] Design

### 架构概览

```
Next.js 16 (App Router)
├── Tailwind CSS 4 (样式)
├── Decap CMS (内容管理，Git-based)
├── Prisma + PostgreSQL (数据库)
├── NextAuth.js (认证)
└── Vercel (部署)
```

### 页面结构

| 路径 | 页面 | 描述 |
|------|------|------|
| `/` | 首页 | 战队介绍、最新动态、精选文章 |
| `/blog` | 博客列表 | 文章列表，分类/标签筛选 |
| `/blog/[slug]` | 文章详情 | Markdown 渲染，评论区 |
| `/docs` | 文档首页 | 文档导航 |
| `/docs/[...slug]` | 文档页面 | 多层级文档，侧边栏 |
| `/team` | 团队页面 | 成员卡片、角色、社交链接 |
| `/about` | 关于 | 战队历史、荣誉、联系方式 |
| `/admin` | CMS 后台 | Decap CMS 管理界面 |

### 内容管理 (Decap CMS)

- 博客文章：`src/content/blog/{locale}/{slug}.md`
- 文档：`src/content/docs/{locale}/{slug}.md`
- 团队数据：`src/content/team/members.yml`
- 支持 frontmatter 配置：标题、日期、分类、标签、封面图、作者

### 数据库模型

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  role      Role     @default(VISITOR)
  comments  Comment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  postSlug  String
  locale    String   @default("zh")
  approved  Boolean  @default(false)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([postSlug, locale])
  @@index([userId])
}

model ViewStat {
  id    String @id @default(cuid())
  slug  String
  locale String @default("zh")
  views Int    @default(0)

  @@unique([slug, locale])
}

enum Role {
  VISITOR
  MEMBER
  ADMIN
}
```

### 国际化 (i18n)

- 默认语言：中文 (zh)
- 支持语言：中文、英文 (en)
- 路由策略：`/zh/blog/...`, `/en/blog/...`
- 使用 `next-intl` 库

### 暗色模式

- 使用 Tailwind CSS 的 `dark:` 变体
- 系统偏好检测 + 手动切换
- 使用 `next-themes` 管理主题状态

### 代码高亮

- 使用 `shiki` 或 `rehype-pretty-code`
- 支持常见语言：TypeScript, Python, Bash, JSON 等
- 代码块带复制按钮

### 认证与权限

- NextAuth.js + GitHub OAuth（管理员登录）
- 仅 ADMIN 角色可发布内容
- 评论需登录（支持 GitHub/邮箱登录）
- 评论需审核后才显示

### 评论系统

- 基于 PostgreSQL 存储
- 管理员审核机制
- 支持 Markdown 格式评论

### 浏览统计

- 基于 PostgreSQL 存储
- 每篇文章独立计数
- 首页展示热门文章

### 部署

- Vercel 部署，自动从 main 分支部署
- 环境变量：DATABASE_URL, NEXTAUTH_SECRET, GITHUB_ID, GITHUB_SECRET
- PostgreSQL 使用 Vercel Postgres 或 Supabase

### 品牌设计

- 队名：TeamFwlcons
- 定位：学校 CS2 电竞战队
- 主题色：深蓝 + 金黄（电竞风格）
- 风格：现代、专业、电竞感

## [S3] Out of Scope

- 实时聊天/IM 功能
- 赛事直播集成
- 移动端 App
- 付费/会员系统
- 电商/周边商店
- 复杂的 RBAC 权限系统

## Tasks

- [x] T1: 项目初始化 — Next.js 16 + Tailwind CSS 4 + TypeScript 项目搭建，配置 ESLint/Prettier (covers: S2 架构)
- [x] T2: 数据库设计与 Prisma 配置 — 创建 Prisma schema，配置 PostgreSQL 连接，生成迁移 (covers: S2 数据库模型)
- [x] T3: 认证系统 — NextAuth.js 集成，GitHub OAuth 配置，角色中间件 (covers: S2 认证与权限; depends: T2)
- [x] T4: 国际化配置 — next-intl 集成，中英文路由策略，翻译文件 (covers: S2 国际化)
- [x] T5: 布局与主题 — 全局布局组件，导航栏，页脚，暗色模式切换 (covers: S2 暗色模式, S2 品牌设计)
- [x] T6: 首页 — Hero 区域，最新动态，精选文章，战队简介 (covers: S2 页面结构; depends: T5)
- [x] T7: 博客系统 — 博客列表页，文章详情页，Markdown 渲染，代码高亮，分类/标签 (covers: S2 页面结构, S2 代码高亮)
- [x] T8: 文档系统 — 文档布局，侧边栏导航，多层级文档，搜索功能 (covers: S2 页面结构)
- [x] T9: 团队页面 — 成员卡片，角色展示，社交链接 (covers: S2 页面结构; depends: T5)
- [x] T10: 评论系统 — 评论组件，审核机制，Markdown 支持 (covers: S2 评论系统; depends: T2, T3, T7)
- [x] T11: 浏览统计 — 文章浏览计数，热门文章展示 (covers: S2 浏览统计; depends: T2, T7)
- [x] T12: Decap CMS 集成 — CMS 配置，管理后台页面，内容模型定义 (covers: S2 内容管理)
- [x] T13: SEO 与性能 — meta 标签，Open Graph，sitemap，图片优化 (covers: S2 部署)
- [x] T14: 部署配置 — Vercel 配置，环境变量，数据库连接，CI/CD (covers: S2 部署; depends: T1-T13)
