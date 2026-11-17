import { getPage, pageMeta } from "../../lib/seo";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ContactForm } from "../../components/forms";
import { inquiryTypes } from "../../components/inquiry-types";
import { getProperties } from "../../lib/content";
import { getSettings } from "../../lib/settings";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import { Arrow } from "../../components/home-icons";

export const generateMetadata = () =>
  pageMeta("contact", {
    title: "Contact management",
    description: "Questions about a property, your tenancy or our services? Contact the Haskins property management team.",
  });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const routes: Record<string, string> = {
  "General inquiry": "Anything about the portfolio",
  "Space inquiry": "Prospective tenants",
  "Tenant support": "Current tenants",
  "Property services": "Owners & families",
};

const steps = [
  ["01", "Choose your inquiry type", "General, space, tenant support or property services."],
  ["02", "Select your property", "So the owning entity and the right team can be identified."],
  ["03", "We route it to the right team", "Questions about a tenancy and leasing inquiries are handled separately."],
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; property?: string }>;
}) {
  const { type, property } = await searchParams;
  const page = await getPage("contact");
  const settings = await getSettings();
  const properties = await getProperties();
  return (
    <PageShell crumb={[{ name: "Contact", path: "/contact" }]}>
      <PageHero
        kicker="Contact"
        title="Good relationships"
        accent="start here."
        text={page?.content || "Questions about a property, your tenancy or our services? Choose your inquiry type and property so the right team can help."}
        aside={
          <ul className="hk-routes hk-in" style={delay(620)}>
            {inquiryTypes.map((t, i) => (
              <li key={t}>
                <Link href={`/contact?type=${encodeURIComponent(t)}#inquiry`}>
                  <span className="mono hk-amber">{`0${i + 1}`}</span>
                  <span className="disp">{t}</span>
                  <span className="mono hk-routes-sub">{routes[t]}</span>
                  <span className="hk-routes-arrow" aria-hidden="true">
                    <Arrow size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        }
      />

      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <div className="hk-contact">
            <aside className="hk-contact-card" data-reveal>
              <span className="mono hk-amber">Property management</span>
              <h3 className="disp">
                Buzz Haskins
                <br />
                Equipment Co., Inc.
              </h3>
              <p className="hk-pre">
                {settings.address || "South San Francisco\nCalifornia 94080"}
              </p>
              <span className="hk-contact-rule" aria-hidden="true" />
              <ul className="hk-contact-list">
                <li>
                  <span className="mono">Phone</span>
                  {settings.phone ? (
                    <a href={settings.tel || undefined}>{settings.phone}</a>
                  ) : (
                    <span>To be added after owner confirmation</span>
                  )}
                </li>
                <li>
                  <span className="mono">Email</span>
                  {settings.email ? (
                    <a href={settings.mailto || undefined}>{settings.email}</a>
                  ) : (
                    <span>To be added after owner confirmation</span>
                  )}
                </li>
                <li>
                  <span className="mono">Office hours</span>
                  <span>To be added after owner confirmation</span>
                </li>
              </ul>
              <p className="hk-contact-fine">
                Inquiries go straight to the management team. Please do not include payment details.
              </p>
            </aside>
            <div data-reveal style={delay(140)}>
              <ContactForm
                defaultType={type}
                defaultProperty={property}
                properties={properties}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hk-dark hk-blueprint">
        <div className="hk-wrap">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker">
              <i />
              How it works
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d2h hk-white">The right team,</span>
              <span className="serif hk-a2c hk-amber">first time.</span>
            </h2>
          </div>
          <ol className="hk-flow">
            {steps.map(([n, t, d], i) => (
              <li key={n} data-reveal style={delay(i * 120)}>
                <span className="disp hk-flow-n" aria-hidden="true">
                  {n}
                </span>
                <h3 className="disp">{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              Looking for space?
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">See what’s possible.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/available-spaces">
            Explore available spaces <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
