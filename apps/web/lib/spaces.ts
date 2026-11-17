import { getProperties, imageSrc, loadRecords } from "./content";

/** A published "Available space" listing from the admin, with its owning property and legal entity. */
export type Space = {
  slug: string;
  title: string;
  type: string;
  location: string;
  description: string;
  note: string; // ownership / land-interest note
  image: string | null; // the space's own photo, else its property's photo
  imageAlt: string;
  propertyName: string;
  propertySlug: string;
  owner: string; // legal entity that owns the property
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function getSpaces(): Promise<Space[]> {
  const recs = await loadRecords();
  const spaces = recs?.filter((r) => r.kind === "space" && r.property_slug);
  if (!spaces?.length) return [];
  const props = await getProperties();
  return spaces.map((r) => {
    const p = r.payload ?? {};
    const prop = props.find((x) => x.slug === r.property_slug);
    return {
      slug: r.slug,
      title: r.title,
      type: s(p.type),
      location: s(p.location),
      description: s(p.description),
      note: s(p.ownershipNote),
      image: imageSrc(s(p.image) || null) ?? prop?.image ?? null,
      imageAlt: s(p.imageAlt) || r.title,
      propertyName: r.property_name ?? prop?.name ?? "",
      propertySlug: r.property_slug as string,
      owner: r.property_owner ?? prop?.owner ?? "",
    };
  });
}
