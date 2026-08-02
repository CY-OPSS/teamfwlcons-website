import { useTranslations } from "next-intl";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-8">
        {t("title")}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* History */}
        <section>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
            {t("history")}
          </h2>
          <div className="prose dark:prose-invert">
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
              TeamFwlcons 成立于学校电竞社团，最初由一群热爱 Counter-Strike
              的同学组成。经过不断的发展和壮大，我们已经成为学校最具竞争力的
              CS2 战队之一。
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed mt-4">
              我们致力于培养团队协作精神，提升个人技术水平，并在各类校际和区域比赛中争取优异成绩。
            </p>
          </div>
        </section>

        {/* Honors */}
        <section>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
            {t("honors")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  校际 CS2 联赛 冠军
                </h3>
                <p className="text-sm text-neutral-500">2025</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">🥈</span>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  区域电竞锦标赛 亚军
                </h3>
                <p className="text-sm text-neutral-500">2024</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">🥉</span>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  校内电竞节 季军
                </h3>
                <p className="text-sm text-neutral-500">2024</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Contact */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
          {t("contact")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <span className="text-2xl">💬</span>
            <div>
              <div className="font-semibold text-neutral-900 dark:text-white">
                Discord
              </div>
              <div className="text-sm text-neutral-500">加入我们的服务器</div>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <span className="text-2xl">🐦</span>
            <div>
              <div className="font-semibold text-neutral-900 dark:text-white">
                Twitter
              </div>
              <div className="text-sm text-neutral-500">@TeamFwlcons</div>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <span className="text-2xl">🎮</span>
            <div>
              <div className="font-semibold text-neutral-900 dark:text-white">
                Steam
              </div>
              <div className="text-sm text-neutral-500">Steam 组</div>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <span className="text-2xl">📧</span>
            <div>
              <div className="font-semibold text-neutral-900 dark:text-white">
                Email
              </div>
              <div className="text-sm text-neutral-500">team@fwlcons.gg</div>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
