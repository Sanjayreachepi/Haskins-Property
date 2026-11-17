import { loadRecords, type SiteProperty } from "./content";

export type EntityItem = { name: string; badge?: string; note?: string };
export type EntityGroup = { name: string; items: EntityItem[] };

/** How a property is shown under its owner: a badge + note for land-only and partial interests. */
function toItem(p: SiteProperty): EntityItem {
  const item: EntityItem = { name: p.name };
  if (p.landOnly) {
    item.badge = "Land only";
    item.note = p.landNote;
  } else if (p.share) {
    item.badge = p.share.includes("%") ? p.share : p.share + "%";
    item.note = "Partial ownership interest";
  }
  return item;
}

/**
 * The published legal entities from the admin ("Legal entities"), in the order
 * staff created them, each with the properties it owns. An entity with no
 * published property still appears (with an empty list). If the API has no
 * entity records, the list is derived from the properties' owners instead.
 */
export async function getEntities(
  properties: SiteProperty[],
): Promise<EntityGroup[]> {
  const recs = await loadRecords();
  const ents = recs?.filter((r) => r.kind === "entity");
  if (ents?.length) {
    return ents.map((e) => {
      const legal = e.payload?.legalName;
      return {
        // property owners are matched on the record title (that's what the API joins on)
        name: typeof legal === "string" && legal.trim() ? legal.trim() : e.title,
        items: properties.filter((p) => p.owner === e.title).map(toItem),
      };
    });
  }
  const byOwner: Record<string, EntityGroup> = {};
  for (const p of properties)
    (byOwner[p.owner] ??= { name: p.owner, items: [] }).items.push(toItem(p));
  return Object.values(byOwner);
}
