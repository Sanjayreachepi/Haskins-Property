import type { MetadataRoute } from "next";
import { getProperties } from "../lib/content";
import { getPage } from "../lib/seo";
import { siteUrl } from "../lib/site";

// Always built from the live admin data, never cached at build time.
export const dynamic = "force-dynamic";

/** Public, indexable pages: [path, admin "Pages & SEO" slug, priority]. Tenant-only pages are left out. */
const pages: [string, string, number][] = [
  ["/", "home", 1],
  ["/properties", "properties", 0.9],
  ["/available-spaces", "available-spaces", 0.9],
  ["/services", "services", 0.7],
  ["/history", "history", 0.6],
  ["/contact", "contact", 0.7],
  ["/privacy", "privacy", 0.3],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const [path, slug, priority] of pages) {
    const page = await getPage(slug);
    if (page?.noindex) continue; // pages marked "no-index" in the admin stay out
    entries.push({
      url: page?.canonical || siteUrl + path,
      ...(page?.updated ? { lastModified: new Date(page.updated) } : {}),
      changeFrequency: "monthly",
      priority,
    });
  }

  for (const p of await getProperties()) {
    if (p.seo?.noindex) continue;
    entries.push({
      url: p.seo?.canonical || `${siteUrl}/properties/${p.slug}`,
      ...(p.updated ? { lastModified: new Date(p.updated) } : {}),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  return entries;
}
