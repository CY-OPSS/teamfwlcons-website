import { getTranslations } from "next-intl/server";
import { getAboutContent } from "@/lib/about";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const about = getAboutContent(locale);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-8">
        {t("title")}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
            {t("history")}
          </h2>
          <div className="prose dark:prose-invert">
            {about.history.length === 0 ? (
              <p className="text-neutral-500">暂无内容</p>
            ) : (
              about.history.map((paragraph, index) => (
                <p
                  key={index}
                  className={`text-neutral-600 dark:text-neutral-400 leading-relaxed ${
                    index > 0 ? "mt-4" : ""
                  }`}
                >
                  {paragraph}
                </p>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
            {t("honors")}
          </h2>
          <div className="space-y-4">
            {about.honors.length === 0 ? (
              <p className="text-neutral-500">暂无荣誉</p>
            ) : (
              about.honors.map((honor, index) => (
                <div
                  key={`${honor.title}-${index}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                >
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                    <span className="text-2xl">{honor.icon || "🏆"}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      {honor.title}
                    </h3>
                    <p className="text-sm text-neutral-500">{honor.year}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
          {t("contact")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {about.contacts.length === 0 ? (
            <p className="text-neutral-500">暂无联系方式</p>
          ) : (
            about.contacts.map((contact, index) => (
              <a
                key={`${contact.label}-${index}`}
                href={contact.url || "#"}
                target={
                  contact.url && contact.url !== "#" ? "_blank" : undefined
                }
                rel={
                  contact.url && contact.url !== "#"
                    ? "noopener noreferrer"
                    : undefined
                }
                className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <span className="text-2xl">{contact.icon || "🔗"}</span>
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">
                    {contact.label}
                  </div>
                  <div className="text-sm text-neutral-500">{contact.detail}</div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
