import { useTranslations } from "next-intl";
import { getTeamMembers } from "@/lib/team";

export default function TeamPage() {
  const t = useTranslations("team");
  const members = getTeamMembers();

  const roleLabels: Record<string, string> = {
    captain: t("role.captain"),
    player: t("role.player"),
    coach: t("role.coach"),
    analyst: t("role.analyst"),
    manager: t("role.manager"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
          我们是一支充满激情的 CS2 战队，每位成员都为团队带来独特的价值。
        </p>
      </div>

      {members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Avatar */}
              <div className="aspect-square bg-gradient-to-br from-blue-500 to-purple-600 relative">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl font-bold text-white">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 bg-black/50 text-white text-xs font-medium rounded backdrop-blur-sm">
                    {roleLabels[member.role] || member.role}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  {member.name}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4 line-clamp-3">
                  {member.bio}
                </p>

                {/* Stats */}
                {Object.keys(member.stats).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {member.stats.rating && (
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {member.stats.rating}
                        </div>
                        <div className="text-xs text-neutral-500">Rating</div>
                      </div>
                    )}
                    {member.stats.headshot && (
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {member.stats.headshot}
                        </div>
                        <div className="text-xs text-neutral-500">HS%</div>
                      </div>
                    )}
                    {member.stats.winRate && (
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {member.stats.winRate}
                        </div>
                        <div className="text-xs text-neutral-500">胜率</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Social Links */}
                <div className="flex gap-3">
                  {member.social.steam && (
                    <a
                      href={member.social.steam}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Steam
                    </a>
                  )}
                  {member.social.twitter && (
                    <a
                      href={member.social.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-blue-400 transition-colors"
                    >
                      Twitter
                    </a>
                  )}
                  {member.social.github && (
                    <a
                      href={member.social.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      GitHub
                    </a>
                  )}
                  {member.social.discord && (
                    <a
                      href={member.social.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-indigo-500 transition-colors"
                    >
                      Discord
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
          <p className="text-neutral-500 dark:text-neutral-400">
            团队成员信息即将公布...
          </p>
        </div>
      )}
    </div>
  );
}
