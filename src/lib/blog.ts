import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  locale: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  coverImage?: string;
  author?: string;
  content: string;
  readingTime: number;
}

const contentDir = path.join(process.cwd(), "src/content/blog");

function normalizeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function resolvePostFile(locale: string, slug: string): string | null {
  const localeDir = path.join(contentDir, locale);
  if (!fs.existsSync(localeDir)) {
    return null;
  }

  const decoded = normalizeSlug(slug);
  const candidates = [decoded, slug, encodeURIComponent(decoded)];

  for (const name of candidates) {
    const filePath = path.join(localeDir, `${name}.md`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  const match = fs
    .readdirSync(localeDir)
    .filter((file) => file.endsWith(".md"))
    .find((file) => {
      const name = file.replace(/\.md$/, "");
      return (
        name === decoded ||
        name === slug ||
        encodeURIComponent(name) === slug ||
        encodeURIComponent(name) === decoded
      );
    });

  return match ? path.join(localeDir, match) : null;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export function getBlogPosts(locale: string = "zh"): BlogPost[] {
  const localeDir = path.join(contentDir, locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".md"));

  const posts = files.map((file) => {
    const filePath = path.join(localeDir, file);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContent);

    return {
      slug: file.replace(/\.md$/, ""),
      locale,
      title: data.title || "Untitled",
      description: data.description || "",
      date: data.date || new Date().toISOString(),
      category: data.category || "uncategorized",
      tags: parseTags(data.tags),
      coverImage: data.coverImage,
      author: data.author,
      content,
      readingTime: calculateReadingTime(content),
    };
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getBlogPost(
  slug: string,
  locale: string = "zh"
): BlogPost | null {
  const filePath = resolvePostFile(locale, slug);

  if (!filePath) {
    return null;
  }

  const fileSlug = path.basename(filePath, ".md");
  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContent);

  return {
    slug: fileSlug,
    locale,
    title: data.title || "Untitled",
    description: data.description || "",
    date: data.date || new Date().toISOString(),
    category: data.category || "uncategorized",
    tags: parseTags(data.tags),
    coverImage: data.coverImage,
    author: data.author,
    content,
    readingTime: calculateReadingTime(content),
  };
}

export function getBlogCategories(locale: string = "zh"): string[] {
  const posts = getBlogPosts(locale);
  const categories = new Set(posts.map((p) => p.category));
  return Array.from(categories);
}

export function getBlogTags(locale: string = "zh"): string[] {
  const posts = getBlogPosts(locale);
  const tags = new Set(posts.flatMap((p) => p.tags));
  return Array.from(tags);
}
