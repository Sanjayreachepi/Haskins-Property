import { block, getPage, pageMeta } from "../../lib/seo";
import Link from "next/link";
import type { CSSProperties } from "react";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import { Arrow } from "../../components/home-icons";

export const generateMetadata = () =>
  pageMeta("history", {
    title: "Our history",
    description: "A Bay Area legacy, from Arthur “Buzz” Haskins and the earthmoving business to the family's real-estate portfolio today.",
  });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const archive = [
  ["buzz_on_scraper_114_cropped", "Buzz Haskins operating a scraper"],
  ["scrapers_1b", "Historic Haskins scraper equipment"],
  ["scrapers_4b", "Equipment from the Haskins family archive"],
];

export default async function Page() {
  const page = await getPage("history");
  return (
    <PageShell crumb={[{ name: "Our history", path: "/history" }]}>
      <PageHero
        kicker="The Haskins story"
        title="Built on work."
        accent="Carried forward with care."
        text={page?.content || "A Bay Area legacy, from Arthur “Buzz” Haskins and the earthmoving business to the family’s real-estate portfolio today."}
      />

      <section className="hk-cover" aria-label="Archival aerial view of the original Haskins property">
        <img
          src="/images/buzz_haskins_yard_monitor_bg_1920_1080.webp"
          alt="Archival aerial view of the original Haskins property"
        />
        <span className="hk-corner tl" aria-hidden="true" />
        <span className="hk-corner tr" aria-hidden="true" />
        <span className="hk-corner bl" aria-hidden="true" />
        <span className="hk-corner br" aria-hidden="true" />
        <span className="mono hk-fig hk-fig-top">Fig. 01 — Archival aerial</span>
        <span className="mono hk-fig hk-fig-bottom">The original Haskins yard</span>
      </section>

      <section className="hk-dark hk-blueprint">
        <div className="hk-wrap hk-split hk-split-center hk-split-wide">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker">
              <i />
              Our foundation
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d2h hk-white">The earth moves</span>
              <span className="serif hk-a2c hk-amber">with Haskins.</span>
            </h2>
            <p className="hk-lead-sm">{block(page, "history", "foundationLead")}</p>
            <p className="hk-body hk-soft">
              {block(page, "history", "foundationBody")}
            </p>
          </div>
          <figure className="hk-archive" data-reveal style={delay(140)}>
            <span className="hk-hazard" aria-hidden="true" />
            <div className="hk-archive-img">
              <img
                src="/images/arthur-buzz-haskins-operating-engineers-board-meeting.webp"
                alt="Arthur Buzz Haskins in an archival Operating Engineers board meeting photograph"
                loading="lazy"
              />
            </div>
            <figcaption className="mono">Arthur “Buzz” Haskins</figcaption>
          </figure>
        </div>
      </section>

      <section className="hk-light">
        <div className="hk-wrap">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-light">
              <i />
              From the family archive
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d2h">People. Equipment.</span>
              <span className="serif hk-a2c hk-muted">A sense of place.</span>
            </h2>
          </div>
          <div className="hk-frames">
            {archive.map(([img, alt], i) => (
              <figure key={img} className="hk-frame" data-reveal style={delay(i * 120)}>
                <div className="hk-frame-img">
                  <img src={"/images/" + img + ".webp"} alt={alt} loading="lazy" />
                </div>
                <figcaption>
                  <span className="mono">{`Frame 0${i + 1}`}</span>
                  {block(page, "history", `archive${i + 1}Caption`)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              The portfolio today
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">Roots remain.</span>
              <span className="serif hk-a-cta">See what’s built on them.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/properties">
            Explore our properties <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
