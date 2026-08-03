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
  social: {
    twitter?: string;
    github?: string;
    steam?: string;
    discord?: string;
  };
  stats: {
    rating?: string;
    headshot?: string;
    winRate?: string;
  };
}

const contentDir = path.join(process.cwd(), "src/content/team");

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

      return {
        id: String(member.id || index),
        name: String(member.name || "Unknown"),
        role,
        isCaptain,
        displayRole: formatTeamRole(role, isCaptain),
        avatar: member.avatar ? String(member.avatar) : undefined,
        bio: String(member.bio || ""),
        social: (member.social as TeamMember["social"]) || {},
        stats: (member.stats as TeamMember["stats"]) || {},
      };
    }
  );
}
