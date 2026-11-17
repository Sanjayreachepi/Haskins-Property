import { properties as fallback, management } from "@haskins/shared";

/** Property as the website uses it (same shape whether it comes from the CMS or the fallback file). */
export type SiteProperty = {
  slug: string;
  name: string;
  type: string;
  owner: string;
  image: string | null; // ready-to-use src: a /images/… file or an uploaded API media URL
  description: string;
  location: string; // address / place as entered in the admin, e.g. "South San Francisco, CA 94080"
  city: string; // just the city, derived from `location`
  imageAlt: string; // descriptive alt text for the photo
  landOnly: boolean; // the entity owns the land, not the building
  landNote: string; // wording shown wherever the land-only notice appears
  share: string; // partial ownership share, e.g. "25%" (empty = 100%)
  updated?: string | null; // last change (sitemap <lastmod>)
  seo?: {
    seoTitle: string;
    seoDescription: string;
    canonical: string;
    noindex: boolean;
    ogImage: string | null;
    targetPhrase: string;
  };
};

export { management };

const API = process.env.API_URL || "http://127.0.0.1:4000";

/** Public (browser-facing) address of the API — used for files uploaded in the admin Media library. */
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || API;

export type Rec = {
  kind: string;
  slug: string;
  title: string;
  payload: Record<string, any>;
  owner: string | null;
  updated_at?: string | null;
  property_name?: string | null; // for kinds linked to a property (space, payment)
  property_slug?: string | null;
  property_owner?: string | null;
};

export async function loadRecords(): Promise<Rec[] | null> {
  try {
    const r = await fetch(API + "/api/public/content", {
      cache: "no-store", // admin edits show up on the next page load
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    return (await r.json()) as Rec[];
  } catch {
    return null; // API/DB down: the site keeps working from the built-in data
  }
}

/**
 * Turns an image value into a usable <img src>:
 *  - "/api/media/…"            → uploaded in the admin → served by the API
 *  - "/images/…" or http(s) URL → used as is
 *  - bare base name (built-in data) → /images/<name>.webp
 */
export function imageSrc(img?: string | null): string | null {
  if (!img) return null;
  if (img.startsWith("/api/media/")) return PUBLIC_API + img;
  if (img.startsWith("/") || /^https?:\/\//.test(img)) return img;
  return "/images/" + img + ".webp";
}

/** "114 S. Maple Avenue, South San Francisco, CA 94080" → "South San Francisco". */
export function cityOf(location: string): string {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // drop a trailing "CA" / "CA 94080" state-zip part
  if (parts.length > 1 && /^[A-Za-z]{2}(\s+\d{5}(-\d{4})?)?$/.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] ?? "";
}

const LAND_DEFAULT = "Land interest only — building not owned.";
const SHARE_RE = /(\d+(?:\.\d+)?)% ownership interest/;

/** Land-only / partial-ownership facts for a property (admin fields first, then the old type/description rules). */
function ownership(opts: {
  type: string;
  description: string;
  landOnly?: unknown;
  note?: unknown;
  share?: unknown;
}) {
  const explicit = opts.landOnly === true || opts.landOnly === "true";
  const landOnly = explicit || opts.type === "Ground lease";
  const note = String(opts.note ?? "").trim();
  const share =
    String(opts.share ?? "").trim() ||
    (SHARE_RE.exec(opts.description)?.[1] ? SHARE_RE.exec(opts.description)![1] + "%" : "");
  return { landOnly, landNote: landOnly ? note || LAND_DEFAULT : "", share };
}

// built-in locations, used when the admin hasn't set one
const builtinLocation = (slug: string) =>
  slug === "812-skyline" ? "Daly City, CA" : "South San Francisco, CA 94080";

/** Published properties from the admin panel (falls back to packages/shared if the API is unreachable). */
export async function getProperties(): Promise<SiteProperty[]> {
  const recs = await loadRecords();
  const props = recs?.filter((r) => r.kind === "property" && r.owner);
  if (!props?.length)
    return fallback.map((p) => {
      const location = builtinLocation(p.slug);
      return {
        ...p,
        image: imageSrc(p.image),
        location,
        city: cityOf(location),
        imageAlt: p.name,
        ...ownership({ type: p.type, description: p.description }),
      };
    });
  return props.map((r) => {
    const location =
      String(r.payload.location ?? "").trim() ||
      (fallback.some((f) => f.slug === r.slug) ? builtinLocation(r.slug) : "");
    return {
    slug: r.slug,
    name: r.title,
    type: String(r.payload.type ?? ""),
    owner: r.owner as string,
    image: imageSrc(r.payload.image),
    description: String(r.payload.description ?? ""),
    location,
    city: cityOf(location),
    imageAlt: String(r.payload.imageAlt ?? "").trim() || r.title,
    ...ownership({
      type: String(r.payload.type ?? ""),
      description: String(r.payload.description ?? ""),
      landOnly: r.payload.landOnly,
      note: r.payload.ownershipNote,
      share: r.payload.ownershipShare,
    }),
    updated: r.updated_at ?? null,
    seo: {
      seoTitle: String(r.payload.seoTitle ?? "").trim(),
      seoDescription: String(r.payload.seoDescription ?? "").trim(),
      targetPhrase: String(r.payload.targetPhrase ?? "").trim(),
      canonical: String(r.payload.canonical ?? "").trim(),
      noindex: r.payload.noindex === true || r.payload.noindex === "true",
      ogImage: imageSrc(String(r.payload.ogImage ?? "").trim() || null),
    },
  };
  });
}

/** Published property by slug. */
export async function getProperty(slug: string) {
  return (await getProperties()).find((p) => p.slug === slug);
}
