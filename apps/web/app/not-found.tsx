import Link from "next/link";
import PageShell from "../components/page-shell";
import PageHero from "../components/page-hero";
import { Arrow } from "../components/home-icons";

export default function NotFound() {
  return (
    <PageShell>
      <PageHero
        kicker="404 · Page not found"
        title="A different"
        accent="direction."
        text="The page you are looking for is not here."
        aside={
          <div className="hk-404 hk-in" style={{ "--d": "620ms" } as React.CSSProperties} aria-hidden="true">
            404
          </div>
        }
      />
      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack">
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              Let’s get you back
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">Head home.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/">
            Back to home <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
