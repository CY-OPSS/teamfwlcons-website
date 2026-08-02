import Link from "next/link";
import { useTranslations } from "next-intl";
import { getDocSections } from "@/lib/docs";

export default function DocsPage() {
  const t = useTranslations("docs");
  const sections = getDocSections("zh");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-8">
        {t("title")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <div
            key={section.slug}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
          >
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {section.title}
            </h2>
            <ul className="space-y-2">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className="text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
