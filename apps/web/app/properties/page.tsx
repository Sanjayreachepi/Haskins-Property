import { getPage, pageMeta } from "../../lib/seo";
import type { CSSProperties } from "react";
import { getProperties } from "../../lib/content";
import Portfolio from "../../components/portfolio";
import Entities from "../../components/entities";
import { getEntities } from "../../lib/entities";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";

export const generateMetadata = () =>
  pageMeta("properties", {
    title: "Our properties",
    description: "Explore the Haskins family's industrial and commercial property interests in South San Francisco. Each property is held by its own identified legal entity.",
  });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default async function Page() {
  const page = await getPage("properties");
  const properties = await getProperties();
  const entityCount = (await getEntities(properties)).length;
  return (
    <PageShell crumb={[{ name: "Our properties", path: "/properties" }]}>
      <PageHero
        kicker="Our portfolio"
        title="The right place"
        accent="to put down roots."
        text={page?.content || "Explore our family’s industrial and commercial property interests. Each property is held by its own identified legal entity."}
        aside={
          <dl className="hk-stats hk-in" style={delay(620)}>
            <div className="hk-stat">
              <dt className="mono">Properties</dt>
              <dd className="disp">{properties.length}</dd>
            </div>
            <div className="hk-stat">
              <dt className="mono">Legal entities</dt>
              <dd className="disp">{entityCount}</dd>
            </div>
            <div className="hk-stat hk-stat-wide">
              <dt className="mono">Property management</dt>
              <dd>Buzz Haskins Equipment Co., Inc.</dd>
            </div>
          </dl>
        }
      />

      <section id="portfolio" className="hk-dark hk-blueprint hk-sub-list">
        <div className="hk-wrap">
          <Portfolio properties={properties} />
        </div>
      </section>

      <Entities properties={properties} text="The legal owner appears on every property page. Property management is provided by Buzz Haskins Equipment Co., Inc. The portfolio includes ground lease and partial ownership interests." />
    </PageShell>
  );
}
