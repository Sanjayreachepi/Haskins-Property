export const properties = [
  {
    slug: "110-s-maple",
    name: "110 S. Maple Avenue",
    type: "Industrial / Warehouse",
    owner: "Haskins Industrial Complex, LLC",
    image: "110-s-maple-ave-office-warehouse",
    description:
      "Industrial workspace within the longstanding South San Francisco portfolio.",
  },
  {
    slug: "114-s-maple",
    name: "114 S. Maple Avenue",
    type: "Warehouse / Parking",
    owner: "Haskins Industrial Complex, LLC",
    image: "114-s-maple-ave-warehouse",
    description:
      "Warehouse, yard and parking areas with convenient access to South Maple Avenue.",
  },
  {
    slug: "103-s-linden",
    name: "103 S. Linden Avenue",
    type: "Parking / Yard",
    owner: "Haskins Industrial Complex, LLC",
    image: "103-s-linden-ave-parking-entrance",
    description:
      "A practical parking and yard property in an established industrial neighborhood.",
  },
  {
    slug: "69-s-linden",
    name: "69 S. Linden Avenue",
    type: "Office / Warehouse",
    owner: "Haskins Industrial Complex II, LLC",
    image: "69-s-linden-ave-main-office",
    description:
      "Office and warehouse space serving the local business community.",
  },
  {
    slug: "120-s-maple",
    name: "120 S. Maple Avenue",
    type: "Office",
    owner: "Haskins Industrial Complex II, LLC",
    image: "120-s-maple-ave-office",
    description: "Commercial office space in the heart of South San Francisco.",
  },
  {
    slug: "400-450-e-jamie",
    name: "400 / 450 E. Jamie Court",
    type: "Ground lease",
    owner: "Haskins Commercial Complex, LLC",
    image: "400-450-e-jamie-ct-front-2",
    description:
      "Ground lease interest only. The building is not owned by this entity.",
  },
  {
    slug: "812-skyline",
    name: "812 Skyline Drive",
    type: "Partial ownership",
    owner: "Haskins Land Holdings, LLC",
    image: null,
    description: "25% ownership interest. Located in Daly City, California.",
  },
  {
    slug: "500-e-jamie",
    name: "500 E. Jamie Court",
    type: "Partial ownership",
    owner: "Haskins Land Holdings, LLC",
    image: null,
    description: "50% ownership interest in South San Francisco, California.",
  },
] as const;
export type Property = (typeof properties)[number];
export const management = "Buzz Haskins Equipment Co., Inc.";

export * from "./page-blocks";
export * from "./site-blocks";
