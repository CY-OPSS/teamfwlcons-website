# 5E 战绩自动同步设置

电脑不必开机。GitHub Actions 每 6 小时在云端拉取数据，写入公开的展示用 JSON。

## 隐私原则

| 内容 | 存放位置 | 是否进仓库 |
|------|----------|------------|
| 玩家 domain / uuid 映射 | GitHub Secret `FIVE_E_PLAYERS_JSON` | 否 |
| Bearer Token（可选） | GitHub Secret `FIVE_E_TOKEN` | 否 |
| Cookie（可选） | GitHub Secret `FIVE_E_COOKIE` | 否 |
| 展示用战绩（Rating/KD 等） | `src/content/stats/5e.json` | 是（仅公开战绩字段） |

本地调试可用 `scripts/5e/players.private.json`（已 gitignore），格式见 `players.example.json`。

## 重要：需要 36 位 UUID

主页链接里的短 ID（如 `0123zilycb7f`）只是 **domain**，API 真正要的是 36 位 **uuid**（形如 `0678a1b3-9e38-11ee-9ce2-ec0d9a495494`）。

### 如何抓取每个人的 UUID（约 30 秒）

1. 浏览器登录 [5EPlay](https://arena.5eplay.com/)
2. 打开该队员主页（`https://arena.5eplay.com/data/player/短ID`）
3. 按 **F12** → **Network（网络）**
4. 筛选框输入：`player/home` 或 `v3/player/home`
5. 点开请求，在 URL 里复制 `uuid=` 后面那一串（带横杠、共 36 位）
6. 写入 Secret 的 `uuid` 字段

一人复制一次即可；以后定时同步不用再抓。

## 配置步骤

1. 打开仓库 **Settings → Secrets and variables → Actions**
2. 新增 / 更新 Secret `FIVE_E_PLAYERS_JSON`，内容示例：

```json
[
  {
    "memberId": "captain",
    "domain": "短主页ID",
    "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "profileUrl": "https://arena.5eplay.com/data/player/短主页ID"
  },
  {
    "memberId": "player1",
    "uuid": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  }
]
```

`memberId` 必须与后台团队成员 `id` 一致（如 `captain`、`player1`）。

3. （推荐）登录 5E 网页后，在开发者工具 Network 里复制 `Authorization: Bearer ...`，存为 Secret `FIVE_E_TOKEN`（只填 token，或整段 Bearer 均可）。
4. 若网页有 WAF/登录墙，可再存 `FIVE_E_COOKIE`。
5. 打开 **Actions → Sync 5E stats → Run workflow** 手动跑一次。

## 本地测试

```bash
# PowerShell
$env:FIVE_E_PLAYERS_JSON = Get-Content scripts/5e/players.private.json -Raw
$env:FIVE_E_TOKEN = "你的token"
pip install -r scripts/5e/requirements.txt
python scripts/5e/sync_stats.py
```

## 说明

- 同步优先走 `gate.5eplay.com/.../v3/player/home`，字段对齐个人主页当前赛季面板：Rating、`5E SS`（API `rating3`）、胜率、K/D、ADR。
- 非官方接口，5E 改版后可能失效；失败时会保留上一份成功数据。
- 前台标注「非实时」。
- 不要把 Token / 玩家映射写进 `members.yml` 或提交到 Git。
