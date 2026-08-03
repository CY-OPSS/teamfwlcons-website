import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts } from "@/lib/blog";
import { markdownToHtml } from "@/lib/markdown";
import { ViewCounter } from "@/components/ViewCounter";
import { CommentSection } from "@/components/CommentSection";

export function generateStaticParams() {
  const posts = getBlogPosts("zh");
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const post = getBlogPost(slug, locale);

  if (!post) {
    notFound();
  }

  const contentHtml = await markdownToHtml(post.content);

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
            {post.category}
          </span>
          <time className="text-neutral-500 text-sm">
            {new Date(post.date).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span className="text-neutral-500 text-sm">
            {post.readingTime} 分钟阅读
          </span>
          <ViewCounter slug={slug} locale={locale} />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
          {post.title}
        </h1>

        <p className="text-xl text-neutral-600">
          {post.description}
        </p>

        {post.author && (
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-200 rounded-full" />
            <span className="text-neutral-700 font-medium">
              {post.author}
            </span>
          </div>
        )}
      </header>

      {/* Cover Image */}
      {post.coverImage && (
        <div className="mb-8 rounded-xl overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Content */}
      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-8 pt-8 border-t border-neutral-200">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <CommentSection postSlug={slug} locale={locale} />
    </article>
  );
}
