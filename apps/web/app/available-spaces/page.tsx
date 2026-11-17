import { getPage, pageMeta } from "../../lib/seo";
import Link from "next/link";
import Card from "../../components/card";
import { imageSrc } from "../../lib/content";
import { getSpaces } from "../../lib/spaces";
import PageShell from "../../components/page-shell";
import PageHero from "../../components/page-hero";
import { Arrow } from "../../components/home-icons";

export const generateMetadata = () =>
  pageMeta("available-spaces", {
    title: "Available spaces",
    description: "Parking, yard, industrial, storage and office space across the Haskins portfolio. Ask management about current opportunities.",
  });

const types = [
  [
    "Parking & yard",
    "103-s-linden-ave-parking-entrance",
    "Practical outdoor space for parking and yard needs.",
  ],
  [
    "Industrial & storage",
    "114-s-maple-ave-warehouse",
    "Warehouse and industrial spaces for your next chapter.",
  ],
  [
    "Office space",
    "120-s-maple-ave-office",
    "A connected base for your business in South San Francisco.",
  ],
];

export default async function Page() {
  const page = await getPage("available-spaces");
  const spaces = await getSpaces();
  return (
    <PageShell crumb={[{ name: "Available spaces", path: "/available-spaces" }]}>
      <PageHero
        kicker="Find your space"
        title="Room for"
        accent="what comes next."
        text={page?.content || "Explore the kinds of space in our portfolio and ask management about current opportunities."}
      />

      <section className="hk-dark hk-blueprint hk-sub-list">
        <div className="hk-wrap">
          <div className="hk-callout" data-reveal>
            <span className="hk-callout-dot" aria-hidden="true" />
            <div>
              <strong>
                {spaces.length
                  ? `${spaces.length} listing${spaces.length === 1 ? "" : "s"} from our portfolio`
                  : "Ask us about current availability"}
              </strong>
              <p>
                {spaces.length
                  ? "Each listing names the property and the legal entity that owns it. Availability, specifications and terms are confirmed directly by management."
                  : "No live availability inventory is published at the moment. Images show portfolio properties and do not indicate vacancies."}
              </p>
            </div>
          </div>
          <div className="ui-cards">
            {spaces.length
              ? spaces.map((sp, n) => (
                  <Card
                    key={sp.slug}
                    order={n}
                    href={`/contact?type=Space%20inquiry&property=${sp.propertySlug}#inquiry`}
                    image={sp.image}
                    imageAlt={sp.imageAlt}
                    tag={sp.type || "Available"}
                    eyebrow={sp.location || sp.propertyName}
                    title={sp.title}
                    description={sp.description}
                    note={sp.note || undefined}
                    footer={
                      <>
                        {sp.propertyName}
                        <br />
                        Owner: {sp.owner}
                      </>
                    }
                  />
                ))
              : types.map(([name, img, desc], n) => (
                  <Card
                    key={name}
                    order={n}
                    href="/contact?type=Space%20inquiry#inquiry"
                    image={imageSrc(img)}
                    imageAlt={name}
                    tag="Availability on inquiry"
                    title={name}
                    description={desc}
                    footer="Ask about this space"
                  />
                ))}
          </div>
        </div>
      </section>

      <section className="hk-cta">
        <div className="hk-wrap hk-cta-row">
          <div className="hk-stack" data-reveal>
            <div className="mono hk-kicker hk-kicker-ink">
              <i />
              Looking for something specific?
            </div>
            <h2 className="hk-h">
              <span className="disp hk-d-cta">Let’s talk space.</span>
            </h2>
          </div>
          <Link className="hk-btn hk-btn-ink hk-btn-lg on-amber" href="/contact">
            Contact management <Arrow />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
