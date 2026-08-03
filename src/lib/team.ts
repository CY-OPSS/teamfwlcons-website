import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { formatTeamRole } from "@/lib/team-roles";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
  displayRole: string;
  avatar?: string;
  bio: string;
  fiveEUrl?: string;
  social: {
    telegram?: string;
    steam?: string;
    github?: string;
  };
  stats: {
    rating?: string;
    headshot?: string;
    winRate?: string;
  };
}

const contentDir = path.join(process.cwd(), "src/content/team");

function isUsableUrl(value?: string) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith("://") || trimmed.endsWith(".com/") || trimmed.endsWith(".com/id/")) {
    return false;
  }
  // Incomplete placeholders like https://t.me/ or https://steamcommunity.com/id/
  if (/^https?:\/\/[^/]+\/?$/.test(trimmed)) return false;
  if (/^https?:\/\/t\.me\/?$/.test(trimmed)) return false;
  if (/^https?:\/\/steamcommunity\.com\/(id|profiles)\/?$/.test(trimmed)) {
    return false;
  }
  return /^https?:\/\//.test(trimmed);
}

export function getTeamMembers(): TeamMember[] {
  const filePath = path.join(contentDir, "members.yml");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data } = matter(fileContent);

  return (data.members || []).map(
    (member: Record<string, unknown>, index: number) => {
      const role = String(member.role || "Support");
      const isCaptain = Boolean(member.isCaptain);
      const socialRaw = (member.social as Record<string, string>) || {};
      const fiveEUrl = member.fiveEUrl ? String(member.fiveEUrl) : undefined;

      return {
        id: String(member.id || index),
        name: String(member.name || "Unknown"),
        role,
        isCaptain,
        displayRole: formatTeamRole(role, isCaptain),
        avatar: member.avatar ? String(member.avatar) : undefined,
        bio: String(member.bio || ""),
        fiveEUrl: isUsableUrl(fiveEUrl) ? fiveEUrl : undefined,
        social: {
          telegram: isUsableUrl(socialRaw.telegram)
            ? socialRaw.telegram
            : undefined,
          steam: isUsableUrl(socialRaw.steam) ? socialRaw.steam : undefined,
          github: isUsableUrl(socialRaw.github) ? socialRaw.github : undefined,
        },
        stats: (member.stats as TeamMember["stats"]) || {},
      };
    }
  );
}
