import { notFound } from "next/navigation";
import { getDocPage, getDocSections } from "@/lib/docs";
import { markdownToHtml } from "@/lib/markdown";
import Link from "next/link";

export function generateStaticParams() {
  const sections = getDocSections("zh");
  return sections.flatMap((section) =>
    section.pages.map((page) => ({
      slug: page.slug.split("/"),
    }))
  );
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[]; locale: string }>;
}) {
  const { slug, locale } = await params;
  const slugPath = slug.join("/");
  const doc = getDocPage(slugPath, locale);

  if (!doc) {
    notFound();
  }

  const contentHtml = await markdownToHtml(doc.content);
  const sections = getDocSections(locale);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <nav className="sticky top-24 space-y-6">
            {sections.map((section) => (
              <div key={section.slug}>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link
                        href={`/docs/${page.slug}`}
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                          page.slug === slugPath
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="lg:col-span-3">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
              {doc.title}
            </h1>
            {doc.description && (
              <p className="text-xl text-neutral-600 dark:text-neutral-400">
                {doc.description}
              </p>
            )}
          </div>

          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </article>
      </div>
    </div>
  );
}
