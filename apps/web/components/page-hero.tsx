import type { CSSProperties, ReactNode } from "react";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * Blueprint hero used at the top of every inner page (rendered white via `.hk-inner` in home.css).
 * `title` = condensed display line, `accent` = italic serif amber line,
 * `aside` = optional content on the right (stats, image…).
 */
export default function PageHero({
  kicker,
  title,
  accent,
  text,
  aside,
}: {
  kicker: string;
  title: string;
  accent: string;
  text: string;
  aside?: ReactNode;
}) {
  return (
    <section className="hk-dark hk-blueprint hk-sub-hero">
      <div className="hk-wrap">
        <div className="hk-sub-grid">
          <div className="hk-stack">
            <div className="mono hk-kicker hk-in" style={delay(100)}>
              <i />
              {kicker}
            </div>
            <h1 className="hk-h">
              <span className="disp hk-d2h hk-white hk-in" style={delay(220)}>
                {title}
              </span>
              <span className="serif hk-a2c hk-amber hk-in" style={delay(380)}>
                {accent}
              </span>
            </h1>
            <p className="hk-lead-sm hk-narrow-xl hk-in" style={delay(520)}>
              {text}
            </p>
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}
