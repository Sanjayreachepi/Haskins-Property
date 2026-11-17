import type { CSSProperties } from "react";
import { block, getPage, pageMeta } from "../../lib/seo";
import { getSettings } from "../../lib/settings";
import { CookieSettingsButton } from "../../components/consent";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";

export const generateMetadata = () =>
  pageMeta("privacy", {
    title: "Privacy & cookies",
    description:
      "How the Haskins Industrial Complex website handles inquiries, cookies and analytics.",
  });

const NUMBERS = [1, 2, 3, 4, 5, 6];

export default async function Page() {
  const page = await getPage("privacy");
  const settings = await getSettings();
  return (
    <PageShell crumb={[{ name: "Privacy & cookies", path: "/privacy" }]}>
      <PageHero
        kicker="Site information"
        title="Privacy"
        accent="& cookies."
        text={
          page?.content ||
          "How this website handles your information, cookies and analytics."
        }
      />
      <section className="hk-light hk-blueprint-l">
        <div className="hk-wrap">
          <ol className="hk-legal">
            {NUMBERS.map((n, i) => (
              <li
                key={n}
                data-reveal
                style={{ "--d": `${i * 80}ms` } as CSSProperties}
              >
                <span className="disp hk-legal-n" aria-hidden="true">
                  {`0${n}`}
                </span>
                <h2 className="disp">{block(page, "privacy", `s${n}Title`)}</h2>
                <p className="hk-muted">{block(page, "privacy", `s${n}Text`)}</p>
                {n === 4 && (
                  <CookieSettingsButton className="hk-btn hk-btn-ink hk-legal-btn">
                    Cookie settings
                  </CookieSettingsButton>
                )}
                {n === 6 && (settings.email || settings.phone) && (
                  <p className="hk-legal-contact">
                    Contact property management:{" "}
                    {settings.email && (
                      <a href={settings.mailto || undefined}>{settings.email}</a>
                    )}
                    {settings.email && settings.phone && " · "}
                    {settings.phone && (
                      <a href={settings.tel || undefined}>{settings.phone}</a>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </PageShell>
  );
}
