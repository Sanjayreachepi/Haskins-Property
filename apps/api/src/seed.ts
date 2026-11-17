import { rows, db } from "./db";
import properties from "./initial-properties.json";
async function main() {
  for (const owner of new Set(properties.map((p) => p.owner))) {
    const payload = JSON.stringify({ legalName: owner });
    await rows(
      "INSERT IGNORE INTO cms_records(kind,slug,title,payload,published_payload,published_slug,published_title) VALUES ('entity',?,?,?, ?,?,?)",
      [
        owner.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        owner,
        payload,
        payload,
        owner.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        owner,
      ],
    );
  }
  for (const p of properties) {
    const [entity] = await rows(
      "SELECT id FROM cms_records WHERE kind='entity' AND title=?",
      [p.owner],
    );
    const payload = JSON.stringify({
      description: p.description,
      type: p.type,
      image: p.image ? "/images/" + p.image + ".webp" : "",
      imageAlt: p.name,
      location:
        p.slug === "812-skyline"
          ? "Daly City, CA"
          : "South San Francisco, CA 94080",
      seoTitle: p.name,
      seoDescription: p.description,
      ownershipNote: p.description,
    });
    await rows(
      "INSERT IGNORE INTO cms_records(kind,slug,title,entity_id,published_entity_id,payload,published_payload,published_slug,published_title) VALUES ('property',?,?,?,?,?,?,?,?)",
      [p.slug, p.name, entity.id, entity.id, payload, payload, p.slug, p.name],
    );
  }
  for (const [slug, title] of [
    ["home", "Home"],
    ["properties", "Our properties"],
    ["available-spaces", "Available spaces"],
    ["history", "Our history"],
    ["services", "Services"],
    ["contact", "Contact"],
    ["privacy", "Privacy policy"],
    ["tenant-portal", "Tenant portal"],
    ["pay-rent", "Pay rent"],
    ["layout", "Header & footer"],
    ["design", "Design (logo, colors, fonts)"],
  ]) {
    const payload = JSON.stringify({
      content: "",
      seoTitle: title,
      seoDescription: "",
    });
    await rows(
      "INSERT IGNORE INTO cms_records(kind,slug,title,payload,published_payload,published_slug,published_title) VALUES ('page',?,?,?,?,?,?)",
      [slug, title, payload, payload, slug, title],
    );
  }
  console.log("Initial content seeded; existing records preserved");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
