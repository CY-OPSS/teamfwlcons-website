import Link from "next/link";
import { useTranslations } from "next-intl";
import { getBlogPosts, getBlogCategories, getBlogTags } from "@/lib/blog";

export default function BlogPage() {
  const t = useTranslations("blog");
  const posts = getBlogPosts("zh");
  const categories = getBlogCategories("zh");
  const tags = getBlogTags("zh");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-8">
        {t("title")}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-8">
            {/* Categories */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                {t("categories")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                {t("tags")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-sm hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Posts */}
        <div className="lg:col-span-3">
          {posts.length > 0 ? (
            <div className="space-y-8">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                        {post.category}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {new Date(post.date).toLocaleDateString("zh-CN")}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {post.readingTime} {t("readMore")}
                      </span>
                    </div>

                    <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-3">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {post.title}
                      </Link>
                    </h2>

                    <p className="text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-3">
                      {post.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
                      >
                        {t("readMore")} →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
              <p className="text-neutral-500 dark:text-neutral-400 text-lg">
                {t("noPosts")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
