import type { SiteProperty } from "./content";
import { absoluteUrl } from "./seo";
import type { SiteSettings } from "./settings";
import { siteUrl } from "./site";

/**
 * schema.org structured data (JSON-LD). Only facts the site actually states are included:
 * the organization (management contact details come from Site settings), breadcrumbs, and a
 * Place for each property. No ratings, prices, availability or offers are ever invented.
 */

export function organizationSchema(settings: SiteSettings) {
  const firstLine = settings.address.split("\n")[0]?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": siteUrl + "/#organization",
    name: settings.siteName,
    url: siteUrl + "/",
    description: settings.defaultDescription,
    ...(settings.logo ? { logo: absoluteUrl(settings.logo) } : {}),
    ...(settings.social.length ? { sameAs: settings.social } : {}),
    address: {
      "@type": "PostalAddress",
      ...(firstLine && settings.address.includes("\n") ? { streetAddress: firstLine } : {}),
      addressLocality: "South San Francisco",
      addressRegion: "CA",
      postalCode: "94080",
      addressCountry: "US",
    },
    ...(settings.phone || settings.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "property management",
            ...(settings.phone ? { telephone: settings.phone } : {}),
            ...(settings.email ? { email: settings.email } : {}),
            areaServed: "US",
            availableLanguage: "English",
          },
        }
      : {}),
  };
}

export function websiteSchema(settings: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteUrl + "/#website",
    name: settings.siteName,
    url: siteUrl + "/",
    publisher: { "@id": siteUrl + "/#organization" },
    inLanguage: "en-US",
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl + (it.path === "/" ? "/" : it.path),
    })),
  };
}

export function placeSchema(p: SiteProperty) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: p.name,
    url: `${siteUrl}/properties/${p.slug}`,
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: absoluteUrl(p.image) } : {}),
    ...(p.location
      ? { address: { "@type": "PostalAddress", streetAddress: p.name, addressLocality: p.city, addressRegion: "CA", addressCountry: "US" } }
      : {}),
  };
}
