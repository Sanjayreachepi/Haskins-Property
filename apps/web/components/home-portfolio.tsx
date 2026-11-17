"use client";
import { useState } from "react";
import type { SiteProperty } from "../lib/content";
import Card from "./card";
import FilterTabs from "./filter-tabs";

const defaultTabs = ["All", "Industrial", "Warehouse", "Parking", "Yard"];

/**
 * Property cards with a type filter. The first tab is always "show all".
 * Tab labels are matched (case-insensitively) against each property's `type`.
 */
export default function HomePortfolio({
  properties,
  limit,
  chips = defaultTabs,
}: {
  properties: SiteProperty[];
  limit?: number;
  chips?: string[];
}) {
  const featured = limit ? properties.slice(0, limit) : properties;
  const [filter, setFilter] = useState(chips[0]);
  const shown = featured
    .map((p, i) => ({ p, idx: String(i + 1).padStart(2, "0") }))
    .filter(
      ({ p }) =>
        filter === chips[0] || p.type.toLowerCase().includes(filter.toLowerCase()),
    );
  return (
    <>
      <FilterTabs
        label="Filter properties by use"
        options={chips}
        value={filter}
        onChange={setFilter}
        summary={`Showing ${shown.length} of ${featured.length} properties`}
      />
      {/* keyed by the filter so the cards re-play their entrance animation on every tab change */}
      <div className="ui-cards" key={filter}>
        {shown.map(({ p, idx }, n) => (
          <Card
            key={p.slug}
            order={n}
            href={"/properties/" + p.slug}
            image={p.image}
            imageAlt={p.imageAlt}
            tag={p.type}
            index={idx}
            eyebrow={p.city || undefined}
            title={p.name}
            note={p.landOnly ? p.landNote : undefined}
            footer={
              <>
                Property owner:
                <br />
                {p.owner}
              </>
            }
          />
        ))}
      </div>
    </>
  );
}
