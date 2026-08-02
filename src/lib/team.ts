import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
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
    (member: Record<string, unknown>, index: number) => ({
      id: member.id || String(index),
      name: member.name || "Unknown",
      role: member.role || "player",
      avatar: member.avatar,
      bio: member.bio || "",
      social: member.social || {},
      stats: member.stats || {},
    })
  );
}
