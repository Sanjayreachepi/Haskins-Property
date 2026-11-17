import { block, getPage, pageMeta } from "../../lib/seo";
import Link from "next/link";
import type { CSSProperties } from "react";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import { Arrow } from "../../components/home-icons";

export const generateMetadata = () =>
  pageMeta("services", {
    title: "Property administration",
    description: "Practical property administration and maintenance support for select commercial property owners and family ownership groups.",
  });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const serviceNumbers = ["01", "02", "03", "04", "05"];

export default async function Page() {
  const page = await getPage("services");
  return (
    <PageShell crumb={[{ name: "Property administration", path: "/services" }]}>
      <PageHero
        kicker="Provided by Buzz Haskins Equipment Co., Inc."
        title="Experience that"
        accent="works for owners."
        text={page?.content || "Practical property administration and maintenance support for select commercial property owners and family ownership groups."}
      />

      <section className="hk-light">
        <div className="hk-wrap">
          <div className="hk-svc-banner" data-reveal>
            <h2 className="hk-h">
              <span className="disp hk-svc-d">Decades of experience.</span>
              <span className="serif hk-svc-a hk-muted">Streamlined operations.</span>
            </h2>
            <p className="hk-body hk-muted">{block(page, "services", "bannerText")}</p>
          </div>

          <ol className="hk-svc-list">
            {serviceNumbers.map((n, i) => (
              <li key={n} className="hk-svc" data-reveal style={delay(i * 80)}>
                <span className="disp hk-svc-n" aria-hidden="true">
                  {n}
                </span>
                <h3 className="disp hk-svc-t">
                  {block(page, "services", `s${i + 1}Title`)}
                </h3>
                <p className="hk-muted">{block(page, "services", `s${i + 1}Text`)}</p>
              </li>
            ))}
          </ol>

          <div className="hk-scope" data-reveal>
            <span className="mono hk-amber">A clearly defined scope</span>
            <p>{block(page, "services", "scopeText")}</p>
          </div>
        </div>
      </section>

      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              Property support
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">Let’s talk about</span>
              <span className="serif hk-a-cta">your property.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/contact">
            Discuss property support <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
