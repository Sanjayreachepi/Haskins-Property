import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getProperty, management } from "../../../lib/content";
import { buildMetadata, clip } from "../../../lib/seo";
import { getSettings } from "../../../lib/settings";
import JsonLd from "../../../components/json-ld";
import { placeSchema } from "../../../lib/schema";
import PageShell from "../../../components/page-shell";
import PageHero from "../../../components/page-hero";
import { Arrow } from "../../../components/home-icons";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [p, settings] = await Promise.all([getProperty(slug), getSettings()]);
  if (!p) return { title: "Property not found", robots: { index: false } };
  // a descriptive default so every property page has a useful, unique snippet even before staff edit it
  const description = clip(
    [`${p.name}${p.location ? ", " + p.location : ""}.`, `Property owner: ${p.owner}.`, p.description].join(" "),
  );
  return buildMetadata(
    // the seeded placeholder (SEO description = property description) counts as "not set"
    p.seo ? { ...p.seo, seoDescription: p.seo.seoDescription === p.description ? "" : p.seo.seoDescription } : null,
    { title: p.name, description },
    { path: `/properties/${p.slug}`, settings, image: p.image },
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) notFound();
  return (
    <PageShell
      crumb={[
        { name: "Our properties", path: "/properties" },
        { name: p.name, path: `/properties/${p.slug}` },
      ]}
    >
      <JsonLd data={placeSchema(p)} />
      <PageHero
        kicker={[p.type, p.location].filter(Boolean).join(" · ")}
        title={p.name}
        accent={`Owned by ${p.owner}.`}
        text={p.description}
        aside={
          <dl className="hk-stats hk-in" style={delay(620)}>
            <div className="hk-stat hk-stat-wide">
              <dt className="mono">Property Owner</dt>
              <dd>{p.owner}</dd>
            </div>
            <div className="hk-stat hk-stat-wide">
              <dt className="mono">Property Management</dt>
              <dd>{management}</dd>
            </div>
          </dl>
        }
      />

      {p.image && (
        <section className="hk-cover" aria-label={p.imageAlt}>
          <img src={p.image} alt={p.imageAlt} />
          <span className="hk-corner tl" aria-hidden="true" />
          <span className="hk-corner tr" aria-hidden="true" />
          <span className="hk-corner bl" aria-hidden="true" />
          <span className="hk-corner br" aria-hidden="true" />
          <span className="mono hk-fig hk-fig-top">{p.type}</span>
          <span className="mono hk-fig hk-fig-bottom">{p.name}</span>
        </section>
      )}

      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap hk-split hk-split-wide">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-light">
              <i />
              The property
            </div>
            <h2 className="hk-h">
              <span className="disp">A place within</span>
              <span className="serif hk-muted">our portfolio.</span>
            </h2>
            <p className="hk-lead">{p.description}</p>
            <p className="hk-body hk-muted">
              For property information or questions about space, connect with
              our management team. Current availability and specifications are
              confirmed directly by management.
            </p>
            {p.landOnly && (
              <div className="hk-land-note">
                <strong>Land only.</strong> {p.landNote}
              </div>
            )}
            <Link
              href={"/contact?property=" + p.slug}
              className="hk-btn hk-btn-ink"
            >
              Inquire about this property <Arrow />
            </Link>
          </div>

          <aside className="hk-pay-result" data-reveal style={delay(140)}>
            <span className="mono hk-amber">Property information</span>
            <h3 className="disp">{p.name}</h3>
            <dl className="hk-pay-dl">
              <div>
                <dt className="mono">Property owner</dt>
                <dd>{p.owner}</dd>
              </div>
              <div>
                <dt className="mono">Property management</dt>
                <dd>{management}</dd>
              </div>
              <div>
                <dt className="mono">Property type</dt>
                <dd>{p.type}</dd>
              </div>
              {p.location && (
                <div>
                <dt className="mono">Location</dt>
                <dd>{p.location}</dd>
              </div>
              )}
            </dl>
            <Link className="text-link" href="/tenant-portal">
              Tenant resources ↗
            </Link>
          </aside>
        </div>
      </section>

      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              More to explore
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">The full portfolio.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/properties">
            View all properties <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
