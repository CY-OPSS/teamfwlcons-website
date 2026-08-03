# 香港镜像部署指南

目标：在中国大陆不翻墙也能较稳定访问站点。  
Vercel 继续作为国际/备用；香港机作为国内访问入口。

## 架构

```
大陆用户 → 自定义域名 → 香港 ECS (Docker / Next.js)
国际用户 → *.vercel.app 或 intl 子域 → Vercel（可选保留）

两边共用同一个 Postgres（推荐 Neon），评论/登录数据一致。
内容文件（团队、文档、5e.json）在 Git 里，推送后两边各自重新部署即可同步。
```

## 1. 买香港机器

推荐任选其一：

| 厂商 | 地区 | 建议配置 |
|------|------|----------|
| 阿里云 | 香港 | 2 核 2G，轻量应用服务器即可 |
| 腾讯云 | 香港 | 2 核 2G 轻量 |

系统选 **Ubuntu 22.04**。放行安全组端口：`22`、`80`、`443`。

## 2. 服务器初始化

SSH 登录后：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录后 docker 才无需 sudo
```

## 3. 拉取代码并配置环境变量

```bash
sudo mkdir -p /opt/teamfwlcons
sudo chown $USER:$USER /opt/teamfwlcons
cd /opt/teamfwlcons
git clone https://github.com/CY-OPSS/teamfwlcons-website.git .
cp .env.hk.example .env.hk
nano .env.hk
```

`.env.hk` 重点：

- `DATABASE_URL`：直接填 Vercel/Neon 同一条（两边数据同步）
- `NEXTAUTH_URL`：填香港域名，例如 `https://hk.your-domain.com`
- `AUTH_SECRET` / `NEXTAUTH_SECRET`：建议与 Vercel 相同

## 4. 构建并启动

```bash
cd /opt/teamfwlcons
docker compose up -d --build
docker compose logs -f web
```

本机访问：`http://服务器公网IP:3000` 能打开即成功。

## 5. 域名与 HTTPS

1. 在域名 DNS 添加：
   - `hk` → `A` → 香港服务器公网 IP  
   或把主站 `www` / `@` 直接指到香港 IP（国内访问优先时推荐）
2. Nginx 反代示例 `/etc/nginx/sites-available/teamfwlcons`：

```nginx
server {
    listen 80;
    server_name hk.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/teamfwlcons /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hk.your-domain.com
```

3. 若用 GitHub OAuth 后台登录：到 GitHub OAuth App 增加回调  
   `https://hk.your-domain.com/api/auth`

## 6. 代码更新（手动）

```bash
cd /opt/teamfwlcons
git pull
docker compose up -d --build
```

## 7. 可选：GitHub Actions 自动部署

仓库已提供 `.github/workflows/deploy-hk-mirror.yml`。  
在 GitHub Secrets 增加：

| Secret | 含义 |
|--------|------|
| `HK_SSH_HOST` | 香港机公网 IP 或域名 |
| `HK_SSH_USER` | 如 `ubuntu` / `root` |
| `HK_SSH_KEY` | 私钥全文 |
| `HK_APP_PATH` | 如 `/opt/teamfwlcons` |

推送到 `main` 后会自动 `git pull` + `docker compose up -d --build`。

## 8. 双站怎么配合

| 内容 | 做法 |
|------|------|
| 页面/团队/文档/5E 战绩 JSON | Git 推送后两边部署 |
| 用户/评论/访问量 | 共用 `DATABASE_URL` |
| 后台改内容 | 仍走 GitHub；两边重建后生效 |
| 5E 定时同步 | 继续用现有 GitHub Actions，推 JSON 进仓库 |

## 常见问题

**Q：香港也打不开？**  
A：先确认安全组放行 80/443；本机 `curl http://127.0.0.1:3000` 是否正常。

**Q：必须备案吗？**  
A：香港机 + 非大陆 CDN **不需要** ICP 备案。

**Q：还要保留 Vercel 吗？**  
A：建议保留作国际备用；国内宣传链接用香港域名即可。
