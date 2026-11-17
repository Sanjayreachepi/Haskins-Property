import { db } from "./db";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
async function main() {
  const conn = await db.getConnection();
  try {
    const [lock]: any = await conn.query(
      "SELECT GET_LOCK('haskins_cms_migrations',30) AS acquired",
    );
    if (!lock[0].acquired) throw Error("Migration lock unavailable");
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );
    const { createHash } = await import("node:crypto");
    for (const name of (await readdir(join(__dirname, "migrations")))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(join(__dirname, "migrations", name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const [existing]: any = await conn.execute(
        "SELECT checksum FROM schema_migrations WHERE name=?",
        [name],
      );
      if (existing.length) {
        if (existing[0].checksum !== checksum)
          throw Error(`Applied migration changed: ${name}`);
        continue;
      }
      for (const statement of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await conn.query(statement);
      await conn.execute(
        "INSERT INTO schema_migrations(name,checksum) VALUES (?,?)",
        [name, checksum],
      );
      console.log(`Applied ${name}`);
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK('haskins_cms_migrations')");
    conn.release();
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
