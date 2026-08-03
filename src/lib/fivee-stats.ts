import fs from "fs";
import path from "path";

export interface FiveEPlayerStats {
  rating?: string;
  winRate?: string;
  kd?: string;
  adr?: string;
  /** Homepage "5E SS" (API field rating3) */
  elo?: string;
}

export interface FiveEPlayerRecord {
  memberId: string;
  profileUrl?: string;
  source?: string;
  syncedAt?: string;
  error?: string;
  stats: FiveEPlayerStats;
}

export interface FiveEStatsFile {
  updatedAt: string | null;
  note?: string;
  players: Record<string, FiveEPlayerRecord>;
}

const statsPath = path.join(process.cwd(), "src/content/stats/5e.json");

export function getFiveEStats(): FiveEStatsFile {
  if (!fs.existsSync(statsPath)) {
    return { updatedAt: null, players: {} };
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(statsPath, "utf8")
    ) as Partial<FiveEStatsFile>;
    return {
      updatedAt: raw.updatedAt ?? null,
      note: raw.note,
      players: raw.players || {},
    };
  } catch {
    return { updatedAt: null, players: {} };
  }
}

export function getFiveEStatsForMember(
  memberId: string
): FiveEPlayerRecord | null {
  const file = getFiveEStats();
  return file.players[memberId] || null;
}
