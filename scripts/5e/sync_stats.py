#!/usr/bin/env python3
"""
Sync public-facing 5EPlay stats into src/content/stats/5e.json.

Privacy:
- Player IDs / tokens MUST come from env secrets or a gitignored local file.
- Output JSON only stores display stats keyed by website memberId.
- Never write tokens, cookies, steamId, real names into the committed JSON.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "src" / "content" / "stats" / "5e.json"
PRIVATE_PLAYERS_PATH = Path(__file__).resolve().parent / "players.private.json"

API_BASE = "https://gate.5eplay.com/crane/http/api/data"
PLATFORM_API = "https://platform-api.5eplay.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
UUID_FIND_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def is_uuid(value: str | None) -> bool:
    return bool(value and UUID_RE.match(value.strip()))


def extract_domain(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if text.startswith("http://") or text.startswith("https://"):
        path = urlparse(text).path.rstrip("/")
        if "/player/" in path:
            return path.split("/player/")[-1] or None
        return path.split("/")[-1] or None
    return text


def extract_uuid_from_url(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if is_uuid(text):
        return text
    if text.startswith("http://") or text.startswith("https://"):
        qs = parse_qs(urlparse(text).query)
        for key in ("uuid", "uid", "user_uuid"):
            for item in qs.get(key, []):
                if is_uuid(item):
                    return item.strip()
        found = UUID_FIND_RE.search(text)
        if found:
            return found.group(0)
    return None


def load_players() -> list[dict[str, str]]:
    """
    Load private player mapping.

    Priority:
    1) FIVE_E_PLAYERS_JSON env (GitHub Secret)
    2) scripts/5e/players.private.json (gitignored local file)

    Each item should provide memberId plus either:
    - uuid (preferred, 36-char)
    - domain / profileUrl (short homepage id; may need token to resolve)
    """
    raw = os.environ.get("FIVE_E_PLAYERS_JSON", "").strip()
    if raw:
        data = json.loads(raw)
    elif PRIVATE_PLAYERS_PATH.exists():
        data = json.loads(PRIVATE_PLAYERS_PATH.read_text(encoding="utf-8"))
    else:
        print(
            "No player mapping found. Set secret FIVE_E_PLAYERS_JSON "
            "or create scripts/5e/players.private.json",
            file=sys.stderr,
        )
        return []

    players: list[dict[str, str]] = []
    for item in data:
        member_id = str(item.get("memberId") or "").strip()
        if not member_id:
            continue

        uuid = extract_uuid_from_url(str(item.get("uuid") or "").strip()) or extract_uuid_from_url(
            str(item.get("profileUrl") or "").strip()
        )
        domain = extract_domain(
            item.get("domain") or item.get("profileUrl") or item.get("uuid")
        )
        # If "domain" field itself is a real uuid, treat it as uuid.
        if not uuid and is_uuid(domain or ""):
            uuid = domain
            domain = None

        if not uuid and not domain:
            continue

        profile_url = str(
            item.get("profileUrl")
            or (
                f"https://arena.5eplay.com/data/player/{domain}"
                if domain
                else f"https://arena.5eplay.com/data/player/?uuid={uuid}"
            )
        ).strip()

        record = {
            "memberId": member_id,
            "profileUrl": profile_url,
        }
        if domain:
            record["domain"] = domain
        if uuid:
            record["uuid"] = uuid
        players.append(record)
    return players


def session_from_env() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/html,*/*",
            "Referer": "https://view-arena.5eplay.com/",
            "Origin": "https://view-arena.5eplay.com",
        }
    )
    token = os.environ.get("FIVE_E_TOKEN", "").strip()
    if token:
        if not token.lower().startswith("bearer "):
            token = f"Bearer {token}"
        session.headers["Authorization"] = token
    cookie = os.environ.get("FIVE_E_COOKIE", "").strip()
    if cookie:
        session.headers["Cookie"] = cookie
    print(
        f"Auth: token={'yes' if os.environ.get('FIVE_E_TOKEN', '').strip() else 'no'}, "
        f"cookie={'yes' if cookie else 'no'}"
    )
    return session


def walk_find_uuid(obj: Any) -> str | None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            lower = str(key).lower()
            if lower in {"uuid", "user_uuid", "uid_uuid"} and is_uuid(str(value)):
                return str(value)
            found = walk_find_uuid(value)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj[:50]:
            found = walk_find_uuid(item)
            if found:
                return found
    elif isinstance(obj, str) and is_uuid(obj):
        return obj
    return None


def resolve_uuid(session: requests.Session, domain: str) -> str | None:
    """Resolve short homepage domain to 36-char UUID."""
    if is_uuid(domain):
        return domain

    # Authenticated platform lookup (may accept domains when logged in).
    payloads = [
        {"domains": [domain]},
        {"domain": domain},
        {"keyword": domain},
        {"domains": domain},
    ]
    endpoints = [
        f"{PLATFORM_API}/api/user/info",
        f"{PLATFORM_API}/api/user/search",
        "https://gate.5eplay.com/userauthinterface/http/api/user/info",
    ]
    for url in endpoints:
        for payload in payloads:
            try:
                res = session.post(url, json=payload, timeout=20)
                if res.status_code >= 400:
                    continue
                data = res.json()
            except (requests.RequestException, ValueError):
                continue
            found = walk_find_uuid(data)
            if found:
                print(f"  resolved domain via {urlparse(url).path}")
                return found

    # Last resort: if HTML somehow contains uuid (rare behind WAF).
    for url in (
        f"https://csgo.5eplay.com/data/player/{domain}",
        f"https://arena.5eplay.com/data/player/{domain}",
    ):
        try:
            res = session.get(url, timeout=20)
            if res.status_code != 200:
                continue
            if "aliyun_waf" in res.text or "acw_sc__v2" in res.text:
                continue
            found = UUID_FIND_RE.search(res.text)
            if found:
                print("  resolved domain via html")
                return found.group(0)
        except requests.RequestException:
            continue
    return None


def pct_text(value: Any) -> str | None:
    if value in (None, "", "-"):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        text = str(value)
        return text if text.endswith("%") else None
    if num <= 1:
        num *= 100
    return f"{num:.0f}%"


def format_num(value: Any, digits: int = 2) -> str | None:
    if value in (None, "", "-"):
        return None
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def parse_v3_home(data: dict[str, Any]) -> dict[str, str]:
    stats: dict[str, str] = {}
    season = data.get("season_data") or {}
    career = data.get("career") or {}

    rating = (
        season.get("avg_rating")
        or season.get("rating")
        or season.get("avg_rating3")
    )
    if rating not in (None, "", "-", 0, 0.0):
        stats["rating"] = format_num(rating, 2) or str(rating)

    hs = pct_text(season.get("per_headshot") or season.get("avg_hs"))
    if hs:
        stats["headshot"] = hs

    win = pct_text(season.get("per_win_match"))
    if not win:
        total = career.get("match_total")
        wins = career.get("match_win")
        try:
            if total and float(total) > 0 and wins is not None:
                win = f"{round(float(wins) / float(total) * 100)}%"
        except (TypeError, ValueError):
            win = None
    if win:
        stats["winRate"] = win

    kills = season.get("kill")
    deaths = season.get("death")
    try:
        if deaths not in (None, "", "-") and float(deaths) > 0 and kills is not None:
            stats["kd"] = f"{float(kills) / float(deaths):.2f}"
        elif kills not in (None, "", "-", 0, 0.0):
            stats["kd"] = format_num(kills, 2) or str(kills)
    except (TypeError, ValueError):
        pass

    adr = season.get("adr") or season.get("avg_adr")
    if adr not in (None, "", "-", 0, 0.0):
        stats["adr"] = format_num(adr, 1) or str(adr)

    elo = career.get("elo") or season.get("elo")
    if elo not in (None, "", "-"):
        stats["elo"] = format_num(elo, 0) or str(elo)

    return stats


def fetch_api_v3_home(session: requests.Session, uuid: str) -> dict[str, str]:
    try:
        res = session.get(
            f"{API_BASE}/v3/player/home",
            params={"uuid": uuid},
            timeout=20,
        )
        payload = res.json()
    except (requests.RequestException, ValueError) as exc:
        print(f"API v3 home failed for {uuid}: {exc}", file=sys.stderr)
        return {}

    data = payload.get("data")
    if not isinstance(data, dict) or not data:
        print(
            f"API v3 home empty for {uuid}: {payload.get('message') or payload.get('errcode')}",
            file=sys.stderr,
        )
        return {}
    return parse_v3_home(data)


def parse_html_stats(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    stats: dict[str, str] = {}

    exact_map = {
        "rating": "rating",
        "k/d": "kd",
        "局均伤害": "adr",
        "adr": "adr",
        "爆头率": "headshot",
        "hs%": "headshot",
        "胜率": "winRate",
        "winrate": "winRate",
        "plr": "elo",
        "elo": "elo",
        "天梯分": "elo",
        "5ess": "elo",
    }

    def assign(label: str, value: str) -> None:
        if not value or value == "-":
            return
        normalized = label.strip().lower()
        field = exact_map.get(normalized)
        if field:
            stats.setdefault(field, value)

    for val in soup.select("span.val"):
        label = val.find_next_sibling("span", class_="label")
        if not label:
            parent = val.parent
            label = parent.select_one(".label") if parent else None
        if not label:
            continue
        assign(label.get_text(strip=True), val.get_text(strip=True))

    pie = soup.select_one("canvas.J_RatingPie[data-cur], #J_RatingPie[data-cur]")
    if pie and pie.get("data-cur"):
        stats["rating"] = str(pie.get("data-cur"))

    return stats


def fetch_html_profile(session: requests.Session, domain: str) -> dict[str, str]:
    urls = [
        f"https://csgo.5eplay.com/data/player/{domain}",
        f"https://arena.5eplay.com/data/player/{domain}",
        f"https://www.5eplay.com/data/player/{domain}",
    ]
    for url in urls:
        try:
            res = session.get(url, timeout=20)
            if res.status_code != 200:
                continue
            if "aliyun_waf" in res.text or "acw_sc__v2" in res.text:
                continue
            stats = parse_html_stats(res.text)
            if stats:
                return stats
        except requests.RequestException as exc:
            print(f"HTML fetch failed for {url}: {exc}", file=sys.stderr)
    return {}


def fetch_from_matches(session: requests.Session, uuid: str) -> dict[str, str]:
    """Aggregate recent match stats when player/home is unavailable."""
    now = int(time.time())
    start = now - 180 * 24 * 3600
    try:
        res = session.get(
            f"{API_BASE}/match/list",
            params={
                "match_type": -1,
                "page": 1,
                "date": 0,
                "start_time": start,
                "end_time": now,
                "uuid": uuid,
                "limit": 30,
                "cs_type": 0,
            },
            timeout=20,
        )
        payload = res.json()
    except (requests.RequestException, ValueError) as exc:
        print(f"API match/list failed for {uuid}: {exc}", file=sys.stderr)
        return {}

    matches = payload.get("data")
    if not isinstance(matches, list) or not matches:
        print(
            f"API match/list empty for {uuid}: {payload.get('message') or payload.get('errcode')}",
            file=sys.stderr,
        )
        return {}

    ratings: list[float] = []
    adrs: list[float] = []
    heads: list[float] = []
    kills = 0
    deaths = 0
    wins = 0
    elos: list[float] = []

    for match in matches:
        try:
            if match.get("rating") not in (None, "", "-"):
                ratings.append(float(match["rating"]))
            if match.get("adr") not in (None, "", "-"):
                adrs.append(float(match["adr"]))
            hs = match.get("per_headshot")
            if hs not in (None, "", "-"):
                num = float(hs)
                if num <= 1:
                    num *= 100
                heads.append(num)
            if match.get("kill") is not None:
                kills += int(match.get("kill") or 0)
            if match.get("death") is not None:
                deaths += int(match.get("death") or 0)
            if match.get("is_win"):
                wins += 1
            elo_val = match.get("level_elo") or match.get("origin_elo")
            level_info = match.get("level_info") or {}
            if isinstance(level_info, dict):
                elo_val = elo_val or level_info.get("elo") or level_info.get("level_elo")
                try:
                    origin = float(level_info.get("origin_elo") or 0)
                    change = float(match.get("change_elo") or 0)
                    if origin or change:
                        elo_val = origin + change
                except (TypeError, ValueError):
                    pass
            if elo_val not in (None, "", "-"):
                elos.append(float(elo_val))
        except (TypeError, ValueError):
            continue

    stats: dict[str, str] = {}
    if ratings:
        stats["rating"] = f"{sum(ratings) / len(ratings):.2f}"
    if adrs:
        stats["adr"] = f"{sum(adrs) / len(adrs):.1f}"
    if heads:
        stats["headshot"] = f"{sum(heads) / len(heads):.0f}%"
    if deaths > 0:
        stats["kd"] = f"{kills / deaths:.2f}"
    elif kills > 0:
        stats["kd"] = str(kills)
    stats["winRate"] = f"{round(wins / len(matches) * 100)}%"
    if elos:
        stats["elo"] = f"{elos[-1]:.0f}"
    print(f"  match/list aggregated {len(matches)} matches")
    return stats


def load_previous() -> dict[str, Any]:
    if not OUTPUT_PATH.exists():
        return {"updatedAt": None, "players": {}}
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"updatedAt": None, "players": {}}


def public_player_record(
    member_id: str,
    profile_url: str,
    stats: dict[str, str],
    source: str,
    error: str | None = None,
) -> dict[str, Any]:
    # Only keep display fields. Never include tokens / private ids beyond memberId.
    record: dict[str, Any] = {
        "memberId": member_id,
        "profileUrl": profile_url,
        "source": source,
        "syncedAt": utc_now(),
        "stats": {
            key: stats[key]
            for key in ("rating", "headshot", "winRate", "kd", "adr", "elo")
            if stats.get(key)
        },
    }
    if error:
        record["error"] = error
    return record


def main() -> int:
    players = load_players()
    previous = load_previous()
    previous_players = previous.get("players") or {}
    session = session_from_env()

    result_players: dict[str, Any] = {}
    ok_count = 0

    for player in players:
        member_id = player["memberId"]
        domain = player.get("domain")
        profile_url = player["profileUrl"]
        uuid = player.get("uuid")
        print(f"Syncing {member_id} ...")

        if not uuid and domain:
            uuid = resolve_uuid(session, domain)
            if not uuid:
                print(
                    f"  cannot resolve domain -> uuid for {domain}. "
                    "Add 36-char uuid to FIVE_E_PLAYERS_JSON.",
                    file=sys.stderr,
                )

        stats: dict[str, str] = {}
        source = "none"
        if uuid:
            stats = fetch_api_v3_home(session, uuid)
            source = "api_v3"
            if not stats:
                stats = fetch_from_matches(session, uuid)
                source = "matches"
        if not stats and domain:
            stats = fetch_html_profile(session, domain)
            source = "html"

        if stats:
            result_players[member_id] = public_player_record(
                member_id, profile_url, stats, source
            )
            ok_count += 1
            print(f"  ok via {source}: {stats}")
        else:
            old = previous_players.get(member_id)
            if isinstance(old, dict) and old.get("stats"):
                kept = dict(old)
                kept["error"] = "sync_failed_kept_previous"
                kept["syncedAt"] = utc_now()
                result_players[member_id] = kept
                print(f"  failed, kept previous stats for {member_id}")
            else:
                result_players[member_id] = public_player_record(
                    member_id,
                    profile_url,
                    {},
                    "none",
                    error="sync_failed_need_uuid"
                    if not uuid
                    else "sync_failed",
                )
                print(f"  failed for {member_id}")
        time.sleep(1.2)

    payload = {
        "updatedAt": utc_now(),
        "note": "Public display stats only. Credentials are never stored here.",
        "players": result_players,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH} ({ok_count}/{len(players)} ok)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
