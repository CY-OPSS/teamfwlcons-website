import Link from "next/link";
import { useTranslations } from "next-intl";
import { getBlogPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const t = useTranslations("home");
  const blogT = useTranslations("blog");
  const posts = getBlogPosts("zh").slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent">
                {t("hero.title")}
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-200 mb-4">
              {t("hero.subtitle")}
            </p>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto mb-8">
              {t("hero.description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/team"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                {t("hero.cta")}
              </Link>
              <Link
                href="/blog"
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-colors backdrop-blur-sm"
              >
                {blogT("title")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Posts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {t("latestPosts")}
          </h2>
          <Link
            href="/blog"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {t("viewAll")} →
          </Link>
        </div>

        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700 overflow-hidden"
              >
                {post.coverImage && (
                  <div className="aspect-video bg-neutral-200 dark:bg-neutral-700">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                      {post.category}
                    </span>
                    <span className="text-sm text-neutral-500">
                      {new Date(post.date).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 line-clamp-3 mb-4">
                    {post.description}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
                  >
                    {blogT("readMore")} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
            <p className="text-neutral-500 dark:text-neutral-400">
              {blogT("noPosts")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
