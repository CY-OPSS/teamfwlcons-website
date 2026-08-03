import { getTranslations } from "next-intl/server";
import { getTeamMembers } from "@/lib/team";
import { getFiveEStats } from "@/lib/fivee-stats";

export default async function TeamPage() {
  const t = await getTranslations("team");
  const members = getTeamMembers();
  const fiveE = getFiveEStats();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
          我们是一支充满激情的 CS2 战队，每位成员都为团队带来独特的价值。
        </p>
        {fiveE.updatedAt && (
          <p className="text-sm text-neutral-400 mt-3">
            5E 战绩缓存更新于 {new Date(fiveE.updatedAt).toLocaleString("zh-CN")}
            （非实时）
          </p>
        )}
      </div>

      {members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {members.map((member) => {
            const live = fiveE.players[member.id];
            const liveStats = live?.stats || {};
            const rating = liveStats.rating || member.stats.rating;
            const winRate = liveStats.winRate || member.stats.winRate;
            const kd = liveStats.kd;
            const adr = liveStats.adr;
            const fiveEss = liveStats.elo;
            const fiveELink =
              member.fiveEUrl ||
              (live?.profileUrl && !live.profileUrl.includes("your-5e")
                ? live.profileUrl
                : undefined);
            const hasStats = Boolean(rating || winRate || kd || adr || fiveEss);
            const hasLiveStats = Boolean(
              liveStats.rating ||
                liveStats.winRate ||
                liveStats.kd ||
                liveStats.adr ||
                liveStats.elo
            );

            return (
              <div
                key={member.id}
                className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gradient-to-br from-blue-500 to-yellow-400 relative">
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
                      {member.displayRole}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    {member.name}
                  </h3>
                  <p className="text-neutral-600 text-sm mb-4 line-clamp-3">
                    {member.bio}
                  </p>

                  {hasStats && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {rating && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {rating}
                          </div>
                          <div className="text-xs text-neutral-500">Rating</div>
                        </div>
                      )}
                      {fiveEss && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">
                            {fiveEss}
                          </div>
                          <div className="text-xs text-neutral-500">5E SS</div>
                        </div>
                      )}
                      {winRate && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-600">
                            {winRate}
                          </div>
                          <div className="text-xs text-neutral-500">胜率</div>
                        </div>
                      )}
                      {kd && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-indigo-600">
                            {kd}
                          </div>
                          <div className="text-xs text-neutral-500">K/D</div>
                        </div>
                      )}
                      {adr && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">
                            {adr}
                          </div>
                          <div className="text-xs text-neutral-500">ADR</div>
                        </div>
                      )}
                    </div>
                  )}
                  {hasLiveStats && (
                    <p className="text-[11px] text-neutral-400 mb-3">
                      数据来源：5E 定时同步
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {member.social.steam && (
                      <a
                        href={member.social.steam}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-blue-600 transition-colors"
                      >
                        Steam
                      </a>
                    )}
                    {member.social.telegram && (
                      <a
                        href={member.social.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-sky-500 transition-colors"
                      >
                        Telegram
                      </a>
                    )}
                    {member.social.github && (
                      <a
                        href={member.social.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-neutral-900 transition-colors"
                      >
                        GitHub
                      </a>
                    )}
                    {fiveELink && (
                      <a
                        href={fiveELink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-orange-500 transition-colors"
                      >
                        5E
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-neutral-50 rounded-xl">
          <p className="text-neutral-500">团队成员信息即将公布...</p>
        </div>
      )}
    </div>
  );
}
