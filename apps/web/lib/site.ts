/**
 * Public address of the website, used for the sitemap and robots.txt.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://www.haskinsindustrialcomplex.com).
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");
