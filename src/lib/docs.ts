import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocPage {
  slug: string;
  locale: string;
  title: string;
  description: string;
  order: number;
  content: string;
}

export interface DocSection {
  title: string;
  slug: string;
  order: number;
  pages: DocPage[];
}

const contentDir = path.join(process.cwd(), "src/content/docs");

export function getDocPage(
  slug: string,
  locale: string = "zh"
): DocPage | null {
  const filePath = path.join(contentDir, locale, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContent);

  return {
    slug,
    locale,
    title: data.title || "Untitled",
    description: data.description || "",
    order: data.order || 0,
    content,
  };
}

export function getDocPages(locale: string = "zh"): DocPage[] {
  const localeDir = path.join(contentDir, locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".md"));

  const pages = files.map((file) => {
    const filePath = path.join(localeDir, file);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContent);

    return {
      slug: file.replace(/\.md$/, ""),
      locale,
      title: data.title || "Untitled",
      description: data.description || "",
      order: data.order || 0,
      content,
    };
  });

  return pages.sort((a, b) => a.order - b.order);
}

export function getDocSections(locale: string = "zh"): DocSection[] {
  const pages = getDocPages(locale);
  const sections = new Map<string, DocSection>();

  pages.forEach((page) => {
    const parts = page.slug.split("/");
    const sectionSlug = parts.length > 1 ? parts[0] : "general";
    const sectionTitle =
      parts.length > 1
        ? sectionSlug.charAt(0).toUpperCase() + sectionSlug.slice(1)
        : "General";

    if (!sections.has(sectionSlug)) {
      sections.set(sectionSlug, {
        title: sectionTitle,
        slug: sectionSlug,
        order: page.order,
        pages: [],
      });
    }

    sections.get(sectionSlug)!.pages.push(page);
  });

  return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}
