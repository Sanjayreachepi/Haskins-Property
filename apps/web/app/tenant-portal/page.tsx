import { getPage, pageMeta } from "../../lib/seo";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import TenantPortal from "../../components/tenant-portal";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import { Arrow } from "../../components/home-icons";

export const generateMetadata = () =>
  pageMeta("tenant-portal", {
    noindex: true, // login / tenant-only page: kept out of search results
    title: "Tenant portal",
    description:
      "Management contacts, payment guidance, notices and documents for Haskins tenants.",
  });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="square"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const features = [
  {
    n: "01",
    title: "Management contacts",
    text: "Property and management contact details for your tenancy, in one place.",
    icon: (
      <Icon>
        <circle cx="16" cy="11" r="5" />
        <path d="M5 28c1-6 5.5-9 11-9s10 3 11 9" />
      </Icon>
    ),
  },
  {
    n: "02",
    title: "Payment guidance",
    text: "Payment and remittance instructions that name the correct owning entity.",
    icon: (
      <Icon>
        <rect x="3" y="8" width="26" height="17" />
        <path d="M3 13h26M8 20h6" />
      </Icon>
    ),
  },
  {
    n: "03",
    title: "Service requests",
    text: "Submit maintenance and service requests and follow their status.",
    icon: (
      <Icon>
        <path d="M20 6a6 6 0 0 0-6 8L4 24l4 4 10-10a6 6 0 0 0 8-6l-4 4-4-1-1-4z" />
      </Icon>
    ),
  },
  {
    n: "04",
    title: "Notices & documents",
    text: "Notices and selected documents shared with your tenancy.",
    icon: (
      <Icon>
        <path d="M8 3h12l6 6v20H8z" />
        <path d="M20 3v6h6M12 15h10M12 20h10M12 25h6" />
      </Icon>
    ),
  },
];

const principles = [
  [
    "Tied to your property",
    "Every tenant account is linked to a specific property and its owning legal entity.",
  ],
  [
    "Only what is yours",
    "Tenants see only the information relevant to their own tenancy — never another tenant’s.",
  ],
  [
    "A clear payee",
    "Payment guidance always identifies the correct legal entity before any external payment.",
  ],
];

export default async function Page() {
  const page = await getPage("tenant-portal");
  return (
    <PageShell crumb={[{ name: "Tenant portal", path: "/tenant-portal" }]}>
      <PageHero
        kicker="Tenant resources"
        title="Everything in"
        accent="one place."
        text={
          page?.content ||
          "Management contacts, payment guidance, notices and documents for your tenancy."
        }
        aside={
          <ul className="hk-tiles hk-in" style={delay(620)}>
            {[
              ["01", "Contacts"],
              ["02", "Payments"],
              ["03", "Service requests"],
              ["04", "Notices"],
            ].map(([n, label]) => (
              <li key={n}>
                <span className="mono hk-amber">{n}</span>
                <span className="disp">{label}</span>
              </li>
            ))}
          </ul>
        }
      />

      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <TenantPortal />
        </div>
      </section>

      <section className="hk-dark hk-blueprint">
        <div className="hk-wrap">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker">
              <i />
              Inside the portal
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d2h hk-white">Built around</span>
              <span className="serif hk-a2c hk-amber">your tenancy.</span>
            </h2>
          </div>
          <ul className="hk-feat">
            {features.map((f, i) => (
              <li
                key={f.n}
                className="hk-feat-item"
                data-reveal
                style={delay(i * 100)}
              >
                <span className="hk-feat-icon">{f.icon}</span>
                <span className="disp hk-feat-n" aria-hidden="true">
                  {f.n}
                </span>
                <h3 className="disp hk-feat-t">{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="hk-light">
        <div className="hk-wrap">
          <div className="hk-split hk-split-end" data-reveal>
            <div className="hk-stack">
              <div className="mono hk-kicker hk-kicker-light">
                <i />
                How access works
              </div>
              <h2 className="hk-h">
                <span className="disp hk-d2h">Private by design.</span>
                <span className="serif hk-a2c hk-muted">Clear by default.</span>
              </h2>
            </div>
            <p className="hk-body hk-muted hk-narrow">
              Tenant accounts are created by property management and linked to
              your property. Your portal shows your property, legal owner,
              payment instructions and shared notices/documents. You can submit
              service requests and follow management replies.
            </p>
          </div>
          <ol className="hk-principles">
            {principles.map(([t, d], i) => (
              <li key={t} data-reveal style={delay(i * 120)}>
                <span className="mono hk-muted">{`0${i + 1}`}</span>
                <h3 className="disp">{t}</h3>
                <p className="hk-muted">{d}</p>
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
              Need account access?
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">Ask management.</span>
            </h2>
          </div>
          <Link
            className="hk-btn hk-btn-ink hk-btn-lg on-amber"
            href="/contact"
          >
            Contact management <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
