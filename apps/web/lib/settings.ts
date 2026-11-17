import { imageSrc, loadRecords } from "./content";

/** Site-wide settings edited in the admin ("Site settings"). Empty strings / arrays = not set yet. */
export type SiteSettings = {
  // management contact
  email: string;
  phone: string;
  address: string;
  /** safe link targets, or "" when the value isn't a valid email / phone number */
  mailto: string;
  tel: string;
  // SEO + business profile
  siteName: string;
  defaultDescription: string;
  defaultImage: string | null;
  logo: string | null;
  social: string[]; // https profile URLs (schema.org sameAs)
  twitter: string; // "@handle" or ""
  googleVerification: string;
  bingVerification: string;
  redirects: string; // raw "from -> to" lines (parsed in lib/redirects.ts)
};

export const DEFAULT_SITE_NAME = "Haskins Industrial Complex";
export const DEFAULT_DESCRIPTION =
  "Explore the Haskins family real-estate portfolio, property information and tenant resources in South San Francisco.";

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function getSettings(): Promise<SiteSettings> {
  const recs = await loadRecords();
  const p = recs?.find((r) => r.kind === "settings")?.payload ?? {};
  const email = s(p.contactEmail);
  const phone = s(p.contactPhone);
  const digits = phone.replace(/[^\d+]/g, "");
  const handle = s(p.twitterHandle).replace(/^@?/, "");
  return {
    email,
    phone,
    address: s(p.address),
    mailto: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "mailto:" + email : "",
    tel: /^\+?\d{7,15}$/.test(digits) ? "tel:" + digits : "",
    siteName: s(p.seoSiteName) || DEFAULT_SITE_NAME,
    defaultDescription: s(p.seoDefaultDescription) || DEFAULT_DESCRIPTION,
    defaultImage: imageSrc(s(p.seoDefaultImage) || null),
    logo: imageSrc(s(p.orgLogo) || null),
    social: s(p.socialLinks)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^https:\/\//.test(l)),
    twitter: handle ? "@" + handle : "",
    googleVerification: s(p.googleVerification),
    bingVerification: s(p.bingVerification),
    redirects: s(p.redirects),
  };
}
