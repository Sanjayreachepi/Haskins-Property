import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { db, rows } from "./db";
import { passwordMatches } from "./security";

async function main() {
  const failures: string[] = [];
  function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "PENDING"}: ${label}`);
    if (!ok) failures.push(label);
  }
  const webEnv: Record<string, string> = {};
  for (const name of [".env", ".env.local"]) {
    try {
      Object.assign(
        webEnv,
        parse(await readFile(path.resolve(__dirname, "../../web", name))),
      );
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const origins = [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN];
  const urls = origins.map((value) => {
    try {
      return new URL(value || "");
    } catch {
      return null;
    }
  });
  check(process.env.NODE_ENV === "production", "NODE_ENV=production");
  check(
    urls.every(
      (url) => url?.protocol === "https:" && !url.username && !url.password,
    ),
    "Public/admin HTTPS origins configured",
  );
  check(
    !!urls[0] && !!urls[1] && urls[0].hostname !== urls[1].hostname,
    "Separate admin hostname configured",
  );
  check(
    process.env.NODE_ENV === "production" ||
      process.env.COOKIE_SECURE === "true",
    "Secure session cookies enabled",
  );
  check(
    !!process.env.SMTP_HOST &&
      !!process.env.MAIL_FROM &&
      !process.env.MAIL_FROM.includes("example.com"),
    "SMTP host and real sender configured (delivery/DNS require external verification)",
  );
  check(
    process.env.SMTP_DEMO !== "true" &&
      !/demo@gmail\.com/i.test(process.env.MAIL_FROM || ""),
    "Demo mailbox replaced with client SMTP identity",
  );
  check(
    (process.env.MFA_ENCRYPTION_KEY || "").length >= 32,
    "Persistent MFA_ENCRYPTION_KEY configured",
  );
  check(
    process.env.ADMIN_MFA_REQUIRED === "true",
    "Administrator MFA required for launch",
  );
  const analyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    webEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    "";
  check(
    /^G-[A-Z0-9]+$/.test(analyticsId),
    "GA4 Measurement ID configured (ownership/live collection require external verification)",
  );
  const applied = new Set(
    (await rows("SELECT name FROM schema_migrations")).map((row) => row.name),
  );
  check(
    (await readdir(path.join(__dirname, "migrations")))
      .filter((name) => name.endsWith(".sql"))
      .every((name) => applied.has(name)),
    "All database migrations applied",
  );
  const users = await rows(
    "SELECT password_hash,mfa_enabled FROM users WHERE role='admin' AND active=1",
  );
  check(
    users.length > 0 &&
      users.every((user) => !passwordMatches("admin@123", user.password_hash)),
    "Active administrator exists; default password removed",
  );
  check(
    users.length > 0 && users.every((user) => !!user.mfa_enabled),
    "Every active administrator enrolled in MFA",
  );
  const [identity] = await rows("SELECT CURRENT_USER() AS account");
  const grants = await rows("SHOW GRANTS FOR CURRENT_USER()");
  const grantText = grants.flatMap((row) => Object.values(row)).join("\n");
  check(
    !/^(root|mysql\.)@/i.test(identity.account) &&
      !/GRANT (?!USAGE)[^\n]+ ON \*\.\*/i.test(grantText) &&
      !/ALL PRIVILEGES|GRANT OPTION|\bCREATE\b|\bDROP\b|\bALTER\b/i.test(
        grantText,
      ),
    "Runtime DB user has restricted data privileges; migrations use a separate identity",
  );
  console.log(
    "MANUAL: confirm HTTPS redirect/certificate renewal, SPF/DKIM and inbox delivery, legal/contact/retention approval, GA4/Search Console owner access, backup restore, production content and browser acceptance.",
  );
  if (failures.length) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error("Launch check failed:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
