import { readFile, writeFile } from "node:fs/promises";
import { db, rows } from "./db";

const fields = [
  "seoTitle",
  "seoDescription",
  "canonical",
  "ogImage",
  "targetPhrase",
  "noindex",
] as const;
const payload = (value: any) =>
  typeof value === "string" ? JSON.parse(value) : value || {};
async function main() {
  const [mode, filename, ...flags] = process.argv.slice(2);
  if (
    !["export", "import"].includes(mode) ||
    !filename ||
    flags.some((flag) => !["--apply", "--publish"].includes(flag))
  )
    throw Error(
      "Usage: seo-transfer.ts export|import <private-json-file> [--apply] [--publish]",
    );
  if (mode === "export") {
    const records = await rows(
      "SELECT kind,slug,payload,published_payload FROM cms_records ORDER BY kind,slug",
    );
    const pick = (value: any) =>
      Object.fromEntries(
        fields
          .filter((key) => Object.hasOwn(payload(value), key))
          .map((key) => [key, payload(value)[key]]),
      );
    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      records: records.map((record) => ({
        kind: record.kind,
        slug: record.slug,
        draft: pick(record.payload),
        published: record.published_payload
          ? pick(record.published_payload)
          : null,
      })),
    };
    await writeFile(filename, JSON.stringify(snapshot, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      `Exported SEO for ${snapshot.records.length} records; file created privately and existing files are never overwritten.`,
    );
    return;
  }
  if (flags.includes("--publish") && !flags.includes("--apply"))
    throw Error("--publish requires --apply; omit both for a dry run.");
  const snapshot = JSON.parse(await readFile(filename, "utf8"));
  if (snapshot.version !== 1 || !Array.isArray(snapshot.records))
    throw Error("Unsupported SEO snapshot");
  const seen = new Set<string>();
  for (const record of snapshot.records) {
    const key = `${record.kind}:${record.slug}`;
    if (!record.kind || !record.slug || seen.has(key))
      throw Error("Invalid/duplicate record in SEO snapshot");
    seen.add(key);
    for (const value of [record.draft, record.published]) {
      if (value === null && value === record.published) continue;
      if (
        !value ||
        Array.isArray(value) ||
        typeof value !== "object" ||
        Object.entries(value).some(
          ([key, item]) =>
            !fields.includes(key as any) ||
            (key === "noindex"
              ? typeof item !== "boolean"
              : typeof item !== "string"),
        )
      )
        throw Error("Invalid SEO fields in snapshot");
    }
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const changes = [];
    for (const record of snapshot.records) {
      const [found]: any = await connection.execute(
        "SELECT id,payload,published_payload FROM cms_records WHERE kind=? AND slug=? FOR UPDATE",
        [record.kind, record.slug],
      );
      if (!found[0])
        throw Error(
          `Target record missing: ${record.kind}/${record.slug}; transfer/seed content before importing SEO.`,
        );
      const current = found[0];
      if (
        flags.includes("--publish") &&
        record.published !== null &&
        current.published_payload === null
      )
        throw Error(
          `Publish the target record explicitly before importing published SEO: ${record.kind}/${record.slug}`,
        );
      changes.push({ current, record });
    }
    if (!flags.includes("--apply")) {
      await connection.rollback();
      console.log(
        `DRY RUN: ${changes.length} records matched by kind/slug. No content or publication state changed. Review canonical domains and restore uploaded media before applying.`,
      );
      return;
    }
    for (const { current, record } of changes) {
      const draft = { ...payload(current.payload), ...record.draft };
      const live =
        flags.includes("--publish") &&
        record.published !== null &&
        current.published_payload !== null
          ? JSON.stringify({
              ...payload(current.published_payload),
              ...record.published,
            })
          : current.published_payload;
      await connection.execute(
        "UPDATE cms_records SET payload=?,published_payload=? WHERE id=?",
        [
          JSON.stringify(draft),
          typeof live === "object" && live !== null
            ? JSON.stringify(live)
            : live,
          current.id,
        ],
      );
    }
    await connection.commit();
    console.log(
      `Imported SEO for ${changes.length} records. ${flags.includes("--publish") ? "Existing published records received their published SEO." : "Drafts updated; publish reviewed changes from the admin panel."}`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
main()
  .catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
