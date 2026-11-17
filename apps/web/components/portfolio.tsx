"use client";
import HomePortfolio from "./home-portfolio";
import type { SiteProperty } from "../lib/content";

// Filter labels are matched (case-insensitively) against each property's `type` string,
// so they must stay aligned with the `type` values in packages/shared.
const filters = [
  "All properties",
  "Industrial",
  "Office",
  "Parking",
  "Ground lease",
  "Partial ownership",
];

export default function Portfolio({ properties }: { properties: SiteProperty[] }) {
  return <HomePortfolio properties={properties} chips={filters} />;
}
