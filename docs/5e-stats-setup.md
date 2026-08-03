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

## 配置步骤

1. 打开仓库 **Settings → Secrets and variables → Actions**
2. 新增 Secret `FIVE_E_PLAYERS_JSON`，内容示例：

```json
[
  {
    "memberId": "captain",
    "domain": "你的5E主页ID",
    "profileUrl": "https://arena.5eplay.com/data/player/你的5E主页ID"
  },
  {
    "memberId": "player1",
    "domain": "另一个ID"
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

- 非官方接口，5E 改版后可能失效；失败时会保留上一份成功数据。
- 前台标注「非实时」。
- 不要把 Token / 玩家映射写进 `members.yml` 或提交到 Git。
