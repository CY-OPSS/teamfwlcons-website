import { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog";
import { getDocPages } from "@/lib/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://teamfwlcons.vercel.app";

  const blogPosts = getBlogPosts("zh").map((post) => ({
    url: `${baseUrl}/zh/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const docPages = getDocPages("zh").map((doc) => ({
    url: `${baseUrl}/zh/docs/${doc.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/zh/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/zh/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/zh/team`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/zh/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...blogPosts,
    ...docPages,
  ];
}
