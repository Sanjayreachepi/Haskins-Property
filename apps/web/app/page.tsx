import { SmartLink as Link } from "../lib/links";
import type { CSSProperties } from "react";
import { getProperties, imageSrc } from "../lib/content";
import { block, getPage, pageMeta } from "../lib/seo";
import { getEntities } from "../lib/entities";
import CountUp from "../components/count-up";
import Entities from "../components/entities";
import HomeEffects from "../components/home-effects";
import HomePortfolio from "../components/home-portfolio";
import CompareSlider from "../components/compare-slider";
import { Arrow, ArrowRight, Spark } from "../components/home-icons";
import "./home.css";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const pillars = [
  {
    n: "01 / Location",
    title: "Connected location",
    text: "South San Francisco, close to the Bay Area’s major transportation routes.",
    icon: (
      <>
        <path d="M16 19.5s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z" />
        <circle cx="16" cy="9.5" r="2.2" />
        <path d="M3 27h26M6 23.5h4M14 23.5h4M22 23.5h4" />
      </>
    ),
  },
  {
    n: "02 / Space",
    title: "Space that works",
    text: "Industrial, office, parking and yard properties for a range of business needs.",
    icon: (
      <>
        <path d="M3 27V12l6-4v4l6-4v4l6-4v4l8-5v20z" />
        <path d="M9 27v-9h12v9M9 21h12M9 24h12M24.5 17v2M2 27h28" />
      </>
    ),
  },
  {
    n: "03 / Stewardship",
    title: "Personal stewardship",
    text: "Family ownership supported by experienced property administration.",
    icon: (
      <>
        <circle cx="10" cy="16" r="6" />
        <circle cx="10" cy="16" r="2" />
        <path d="M16 16h13M24 16v4M28 16v3M4 5h6M4 5v4M28 27h-6M28 27v-4" />
      </>
    ),
  },
];

function MarqueeRow({ marquee, accent }: { marquee: string[]; accent: string }) {
  return (
    <div className="disp hk-marquee-row">
      {marquee.map((w) => (
        <span key={w} className="hk-marquee-item">
          {w === accent ? <span className="serif">{w}</span> : <span>{w}</span>}
          <Spark />
        </span>
      ))}
    </div>
  );
}

export const generateMetadata = () =>
  pageMeta("home", {
    title: "Haskins Industrial Complex | South San Francisco",
    description:
      "Explore the Haskins family real-estate portfolio, property information and tenant resources in South San Francisco.",
    absoluteTitle: true,
  });

export default async function Home() {
  const page = await getPage("home");
  const properties = await getProperties();
  const b = (k: string) => block(page, "home", k);
  const img = (k: string) => imageSrc(b(k)) || "";
  const marquee = b("marqueeWords").split(/\r?\n/).map((w) => w.trim()).filter(Boolean);
  const stats: [number, string][] = [
    [properties.length, b("stat1Label")],
    [(await getEntities(properties)).length, b("stat2Label")],
    [
      new Set(properties.map((p) => p.city).filter(Boolean)).size,
      b("stat3Label"),
    ],
  ];
  return (
    <div className="home">
      <HomeEffects />

      {/* ============ 1 · HERO ============ */}
      <section id="top" className="hk-dark hk-hero">
        {/* full-width banner: the legacy aerial fills the whole width, copy sits on top */}
        <div className="hk-hero-grid">
          <div className="hk-hero-media">
            <img
              src={img("heroImage")}
              alt={b("heroImageAlt")}
              fetchPriority="high"
              decoding="async"
            />
            <span className="hk-corner tl" aria-hidden="true" />
            <span className="hk-corner tr" aria-hidden="true" />
            <span className="hk-corner bl" aria-hidden="true" />
            <span className="hk-corner br" aria-hidden="true" />
            <span className="mono hk-fig hk-fig-top">{b("heroFigTop")}</span>
            <span className="mono hk-fig hk-fig-bottom">{b("heroFigBottom")}</span>
            <svg className="hk-badge" aria-hidden="true" viewBox="0 0 200 200">
              <defs>
                <path id="hkcircle" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
              </defs>
              <circle cx="100" cy="100" r="98" fill="#121211" stroke="#f2a900" strokeWidth="1.5" />
              <text fill="#ffffff" className="hk-badge-text">
                <textPath href="#hkcircle" textLength="470" lengthAdjust="spacing">{b("heroBadge")}</textPath>
              </text>
              <path d="M82 118 L118 82 M92 82 H118 V108" fill="none" stroke="#f2a900" strokeWidth="5" strokeLinecap="square" />
            </svg>
          </div>
          <div className="hk-hero-copy">
            <div className="mono hk-kicker hk-in" style={delay(100)}>
              <i />
              {b("heroKicker")}
            </div>
            <h1 className="hk-h">
              <span className="disp hk-hero-d hk-in" style={delay(220)}>{b("heroLine1")}</span>
              <span className="disp hk-hero-d hk-in" style={delay(340)}>{b("heroLine2")}</span>
              <span className="serif hk-hero-a hk-in" style={delay(480)}>{b("heroAccent")}</span>
            </h1>
            <p className="hk-hero-p hk-in" style={delay(640)}>
              {b("heroText")}
            </p>
            <div className="hk-actions hk-in" style={delay(760)}>
              <Link className="hk-btn hk-btn-amber" href={b("heroBtn1Url")}>
                {b("heroBtn1Label")} <Arrow />
              </Link>
              <Link className="hk-btn hk-btn-ghost hk-btn-ghost-dark" href={b("heroBtn2Url")}>
                {b("heroBtn2Label")}
              </Link>
            </div>
          </div>
        </div>

        <div className="hk-quick-row hk-quick-banner">
          {[1, 2, 3].map((i) => [String(i).padStart(2, "0"), b(`quick${i}Label`), b(`quick${i}Url`)]).map(([n, label, href]) => (
            <Link key={n} className="hk-quick" href={href}>
              <span className="hk-quick-l">
                <span className="mono hk-quick-n">{n}</span>
                <span className="hk-quick-label">{label}</span>
              </span>
              <span className="hk-quick-icon" aria-hidden="true">
                <Arrow size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* marquee divider */}
      <div className="hk-marquee" aria-hidden="true">
        <div className="hk-marquee-track">
          <MarqueeRow marquee={marquee} accent={b("marqueeAccent")} />
          <MarqueeRow marquee={marquee} accent={b("marqueeAccent")} />
        </div>
      </div>

      {/* ============ 2 · INTRO / PILLARS ============ */}
      <section className="hk-light">
        <div className="hk-wrap">
          <div className="hk-split hk-split-center hk-intro">
            <div className="hk-stack" data-reveal>
              <div className="mono hk-kicker hk-kicker-light">
                <i />
                {b("introKicker")}
              </div>
              <h2 className="hk-h">
                <span className="disp hk-intro-d">{b("introLine1")}</span>
                <span className="serif hk-intro-a hk-muted">{b("introLine2")}</span>
              </h2>
              <p className="hk-lead">
                {b("introLead")}
              </p>
              <p className="hk-body hk-muted hk-narrow-xl">
                {b("introBody")}
              </p>
              <Link className="hk-btn hk-btn-ink" href={b("introBtnUrl")}>
                {b("introBtnLabel")} <Arrow />
              </Link>
            </div>

            <div className="hk-collage" data-reveal style={delay(140)}>
              <span className="hk-collage-hazard" aria-hidden="true" />
              <figure className="hk-collage-main">
                <img
                  src={img("introImage1Image")}
                  alt={b("introImage1Alt")}
                  loading="lazy"
                />
                <figcaption className="mono">{b("introCaption")}</figcaption>
              </figure>
              <figure className="hk-collage-sub">
                <img
                  src={img("introImage2Image")}
                  alt={b("introImage2Alt")}
                  loading="lazy"
                />
              </figure>
              <svg className="hk-collage-badge" aria-hidden="true" viewBox="0 0 200 200">
                <defs>
                  <path id="hkcircle2" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
                </defs>
                <circle cx="100" cy="100" r="98" fill="#121211" stroke="#f2a900" strokeWidth="1.5" />
                <text fill="#ffffff" className="hk-badge-text">
                  <textPath href="#hkcircle2" textLength="470" lengthAdjust="spacing">{b("introBadge")}</textPath>
                </text>
                <path d="M82 118 L118 82 M92 82 H118 V108" fill="none" stroke="#f2a900" strokeWidth="5" strokeLinecap="square" />
              </svg>
            </div>
          </div>

          <div className="hk-statband" data-reveal>
            {stats.map(([n, label]) => (
              <div key={label} className="hk-stat-item">
                <span className="disp hk-stat-num">
                  <CountUp to={n} />
                </span>
                <span className="mono">{label}</span>
              </div>
            ))}
          </div>

          <div className="hk-pillars">
            {pillars.map((p, i) => (
              <div key={p.n} className="hk-pillar" data-reveal style={delay(i * 120)}>
                <div className="hk-pillar-top">
                  <span className="mono hk-muted">{b(`pillar${i + 1}Label`)}</span>
                  <span className="hk-pillar-icon" aria-hidden="true">
                    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
                      {p.icon}
                    </svg>
                  </span>
                </div>
                <h3 className="disp hk-pillar-title">
                  {b(`pillar${i + 1}Title`)}
                </h3>
                <p className="hk-muted">{b(`pillar${i + 1}Text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Entities properties={properties} />

      {/* ============ 3 · PORTFOLIO ============ */}
      <section id="portfolio" className="hk-light hk-blueprint-l hk-portfolio-light">
        <div className="hk-wrap">
          <div className="hk-head-row" data-reveal>
            <div className="hk-stack">
              <div className="mono hk-kicker hk-kicker-light">
                <i />
                {b("portfolioKicker")}
              </div>
              <h2 className="hk-h hk-h-inline">
                <span className="disp hk-d2">{b("portfolioWord1")}</span>
                <span className="serif mark hk-a2b">{b("portfolioWord2")}</span>
              </h2>
            </div>
            <Link className="hk-btn hk-btn-ink" href={b("portfolioBtnUrl")}>
              {b("portfolioBtnLabel")} <Arrow />
            </Link>
          </div>
          <HomePortfolio properties={properties} limit={3} />
        </div>
      </section>

      {/* ============ 4 · THEN & NOW ============ */}
      <section className="hk-light">
        <div className="hk-wrap hk-split hk-split-center">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-light">
              <i />
              {b("thenKicker")}
            </div>
            <h2 className="hk-h hk-h-start">
              <span className="disp hk-d3">{b("then1")}</span>
              <span className="disp hk-d3">{b("then2")}</span>
              {/* "Haskins" is the trademark: always the vector logo file, never typed text */}
              <img
                className="hk-then-logo"
                src="/images/logo.svg"
                alt="Haskins Industrial Complex"
                width={612}
                height={264}
              />
            </h2>
            <p className="hk-body hk-muted hk-narrow">
              {b("thenNowText")}
            </p>
            <Link className="hk-btn hk-btn-ghost hk-btn-ghost-light" href={b("thenBtnUrl")}>
              {b("thenBtnLabel")} <ArrowRight />
            </Link>
          </div>
          <div className="hk-stack" data-reveal style={delay(140)}>
            <CompareSlider
              before={img("compareBeforeImage")}
              after={img("compareAfterImage")}
              beforeAlt={b("compareBeforeAlt")}
              afterAlt={b("compareAfterAlt")}
            />
            <div className="hk-compare-caption">
              <span className="mono hk-muted">{b("compareHint")}</span>
              <span className="mono hk-muted">{b("compareCaption")}</span>
            </div>
            <p className="hk-land-note">
              <strong>{b("landLabel")}</strong> {b("landNote")}
            </p>
          </div>
        </div>
      </section>

      {/* ============ 5 · HISTORY ============ */}
      <section id="history" className="hk-dark">
        <div className="hk-wrap hk-split hk-split-center hk-split-wide">
          <figure className="hk-archive" data-reveal>
            <span className="hk-hazard" aria-hidden="true" />
            <div className="hk-archive-img">
              <img
                src={img("historyImage")}
                alt={b("historyImageAlt")}
                loading="lazy"
              />
            </div>
            <figcaption className="mono">{b("historyCaption")}</figcaption>
          </figure>
          <div className="hk-stack" data-reveal style={delay(140)}>
            <div className="mono hk-kicker">
              <i />
              {b("historyKicker")}
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d2h hk-white">{b("history1")}</span>
              <span className="serif hk-a2c hk-amber">{b("history2")}</span>
            </h2>
            <p className="hk-lead-sm">
              {b("historyLead")}
            </p>
            <p className="hk-body hk-soft">
              {b("historyBody")}
            </p>
            <Link className="hk-btn hk-btn-amber" href={b("historyBtnUrl")}>
              {b("historyBtnLabel")} <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 6 · TENANTS ============ */}
      <section id="tenants" className="hk-light hk-blueprint-l hk-tenants">
        <span className="hk-hazard-bar" aria-hidden="true" />
        <div className="hk-wrap">
          <div className="hk-split hk-split-end" data-reveal>
            <div className="hk-stack">
              <div className="mono hk-kicker hk-kicker-light">
                <i />
                {b("tenantKicker")}
              </div>
              <h2 className="hk-h hk-h-start">
                <span className="disp hk-d2t">{b("tenant1")}</span>
                <span className="serif mark hk-a3b">{b("tenant2")}</span>
              </h2>
            </div>
            <div className="hk-stack">
              <p className="hk-body-lg hk-muted">
                {b("tenantText")}
              </p>
              <Link className="hk-btn hk-btn-ink hk-btn-lg" href={b("tenantBtnUrl")}>
                {b("tenantBtnLabel")} <Arrow />
              </Link>
            </div>
          </div>
          <div className="hk-quick-row hk-quick-light" data-reveal>
            {[1, 2, 3].map((i) => [b(`tenantLink${i}Label`), b(`tenantLink${i}Url`)]).map(([label, href]) => (
              <Link key={label} className="hk-quick" href={href}>
                <span className="hk-quick-label">{label}</span>
                <span className="hk-quick-icon plain" aria-hidden="true">
                  <Arrow size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 7 · FINAL CTA ============ */}
      <section id="contact" className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              {b("ctaKicker")}
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">{b("cta1")}</span>
              <span className="serif hk-a-cta">{b("cta2")}</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href={b("ctaBtnUrl")} data-reveal style={delay(140)}>
            {b("ctaBtnLabel")} <Arrow />
          </Link>
        </div>
      </section>
    </div>
  );
}
