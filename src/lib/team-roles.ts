export const TEAM_ROLES = [
  "Entry Fragger",
  "AWPer",
  "In-game Leader",
  "Support",
  "Lurker",
  "Coach",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export function formatTeamRole(role: string, isCaptain?: boolean) {
  if (isCaptain && role !== "Coach") {
    return `Captain / ${role}`;
  }
  return role;
}
