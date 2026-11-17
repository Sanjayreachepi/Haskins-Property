import type { CSSProperties } from "react";
import { management, type SiteProperty } from "../lib/content";
import { getEntities } from "../lib/entities";

const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * "Four separate legal entities" section — shown on the home and properties pages.
 * Styles: app/home.css (`.ent*`). The entities come from the admin (Legal entities).
 */
export default async function Entities({
  properties,
  text = "Haskins Industrial Complex is a central information portal for separately organized, family-owned real estate entities in South San Francisco. Each property is owned by the entity named below — and on its own property page.",
}: {
  properties: SiteProperty[];
  text?: string;
}) {
  const entities = await getEntities(properties);
  const entityCount = entities.length;
  return (
    <section className="ent" aria-labelledby="ent-title">
      <div className="hk-wrap">
        <div className="ent-head" data-reveal>
          <div className="hk-stack">
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              Entity separation
            </div>
            <h2 className="hk-h" id="ent-title">
              <span className="disp ent-d">One website.</span>
              <span className="serif ent-a">
                {words[entityCount] ?? entityCount} separate legal entities.
              </span>
            </h2>
          </div>
          <p className="ent-lead">{text}</p>
        </div>

        <div className="ent-mgmt" data-reveal style={delay(100)}>
          <span className="ent-mgmt-stripe" aria-hidden="true" />
          <div className="ent-mgmt-body">
            <span className="mono">Property Management</span>
            <strong className="ent-mgmt-name">{management}</strong>
          </div>
          <span className="mono ent-mgmt-tag">Manages the portfolio · separate from the owners below</span>
        </div>

        <ol className="ent-plates">
          {entities.map((e, i) => (
            <li key={e.name} className="ent-plate" data-reveal style={delay(160 + i * 110)}>
              <span className="ent-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mono ent-label">Property Owner</span>
              <strong className="ent-name">{e.name}</strong>
              <ul className="ent-props">
                {e.items.length === 0 && (
                  <li>
                    <span className="ent-prop-note">No properties published yet.</span>
                  </li>
                )}
                {e.items.map((it) => (
                  <li key={it.name}>
                    <span className="ent-prop-row">
                      <span>{it.name}</span>
                      {it.badge && <span className="ent-badge">{it.badge}</span>}
                    </span>
                    {it.note && <span className="ent-prop-note">{it.note}</span>}
                  </li>
                ))}
              </ul>
              <span className="mono ent-count">
                {e.items.length} {e.items.length === 1 ? "property" : "properties"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
