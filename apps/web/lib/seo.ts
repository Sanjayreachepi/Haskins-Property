import type { Metadata } from "next";
import { pageBlocks } from "@haskins/shared";
import { imageSrc, loadRecords } from "./content";
import { getSettings, type SiteSettings } from "./settings";
import { siteUrl } from "./site";

export type PageRecord = {
  title: string;
  content: string; // optional intro text edited in the admin ("Page content")
  seoTitle: string;
  seoDescription: string;
  targetPhrase: string;
  canonical: string;
  noindex: boolean;
  ogImage: string | null;
  updated: string | null; // last change (sitemap <lastmod>)
  blocks: Record<string, string>; // named text blocks (see packages/shared page-blocks)
};

/** The SEO fields shared by pages and properties. */
export type SeoRecord = Partial<
  Pick<
    PageRecord,
    "title" | "seoTitle" | "seoDescription" | "targetPhrase" | "canonical" | "noindex" | "ogImage"
  >
>;

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The published "Pages & SEO" record for a page slug (home, services, contact…), or null. */
export async function getPage(slug: string): Promise<PageRecord | null> {
  const recs = await loadRecords();
  const r = recs?.find((x) => x.kind === "page" && x.slug === slug);
  if (!r) return null;
  const p = r.payload ?? {};
  return {
    title: r.title,
    content: s(p.content),
    seoTitle: s(p.seoTitle),
    seoDescription: s(p.seoDescription),
    targetPhrase: s(p.targetPhrase),
    canonical: s(p.canonical),
    noindex: p.noindex === true || p.noindex === "true",
    ogImage: imageSrc(s(p.ogImage) || null),
    updated: r.updated_at ?? null,
    blocks: Object.fromEntries(
      Object.entries(p.blocks ?? {}).map(([k, v]) => [k, s(v)]),
    ),
  };
}

/** Make an image/URL absolute (Open Graph and structured data need absolute URLs). */
export const absoluteUrl = (u: string) =>
  /^https?:\/\//.test(u) ? u : siteUrl + (u.startsWith("/") ? u : "/" + u);

/** Truncate at a word boundary for meta descriptions (≈160 characters is what search shows). */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

const FALLBACK_OG_IMAGE = "/images/buzz_haskins_yard_monitor_bg_1920_1080.webp";

export type MetaDefaults = {
  title: string;
  description?: string;
  absoluteTitle?: boolean;
  /** keep this page out of search results unless staff change it (login / tenant-only pages) */
  noindex?: boolean;
};
export type MetaContext = {
  /** URL path of the page, e.g. "/services" — used for the default canonical and og:url */
  path?: string;
  settings?: SiteSettings;
  /** page-specific social image (e.g. a property photo) used when the admin hasn't set one */
  image?: string | null;
};

/**
 * Metadata for a page. Values edited in the admin (Pages & SEO / the property's SEO fields) win;
 * the `defaults` written in the code fill anything left empty. Always includes a canonical URL,
 * Open Graph and Twitter card tags.
 */
export function buildMetadata(
  rec: SeoRecord | null,
  defaults: MetaDefaults,
  ctx: MetaContext = {},
): Metadata {
  // the seeded placeholder (SEO title = page title) counts as "not set" so the better default wins
  const own = rec?.seoTitle;
  const placeholder = own && (own === rec?.title || own === defaults.title);
  const title = own && !placeholder ? own : defaults.title;
  const description =
    rec?.seoDescription || defaults.description || ctx.settings?.defaultDescription;
  const canonical =
    rec?.canonical || (ctx.path !== undefined ? siteUrl + (ctx.path === "/" ? "/" : ctx.path) : undefined);
  const image = absoluteUrl(
    rec?.ogImage || ctx.image || ctx.settings?.defaultImage || FALLBACK_OG_IMAGE,
  );

  const m: Metadata = {
    title: defaults.absoluteTitle ? { absolute: title } : title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: ctx.settings?.siteName,
      locale: "en_US",
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      ...(ctx.settings?.twitter ? { site: ctx.settings.twitter } : {}),
    },
  };
  if (rec?.targetPhrase) m.keywords = [rec.targetPhrase];
  if (canonical) m.alternates = { canonical };
  if (rec?.noindex || defaults.noindex) m.robots = { index: false, follow: true };
  return m;
}

/** Shortcut for `export const generateMetadata` on a page with an admin "Pages & SEO" record. */
export async function pageMeta(slug: string, defaults: MetaDefaults): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPage(slug), getSettings()]);
  return buildMetadata(page, defaults, {
    path: slug === "home" ? "/" : "/" + slug,
    settings,
  });
}

/**
 * Text for a named block on a fixed-layout page: what staff typed in the admin,
 * else the standard text from packages/shared/src/page-blocks.ts.
 */
export function block(
  page: PageRecord | null,
  slug: string,
  key: string,
): string {
  const fallback = pageBlocks[slug]?.find((b) => b.key === key)?.default ?? "";
  // header/footer: an empty box means "hide this item"
  if (slug === "layout") return page?.blocks[key] ?? fallback;
  return page?.blocks[key] || fallback;
}
