import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  chmod,
  cp,
  mkdir,
  realpath,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run from apps/api, where dotenv and relative storage paths match the API.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = process.env.BACKUP_DIR;
if (!root || !path.isAbsolute(root))
  throw Error(
    "Set BACKUP_DIR to an absolute, private directory outside the checkout and public storage.",
  );
await mkdir(root, { recursive: true, mode: 0o700 });
const backupRoot = await realpath(root);
const storage = [
  process.env.UPLOAD_DIR || "uploads",
  process.env.PRIVATE_DOCUMENT_DIR || "private-tenant-files",
].map((value) => path.resolve(value));
const inside = (value, parent) =>
  value === parent || value.startsWith(parent + path.sep);
if ([repo, ...storage].some((parent) => inside(backupRoot, parent)))
  throw Error(
    "BACKUP_DIR must be outside the checkout, uploads and private document storage.",
  );
await chmod(backupRoot, 0o700);
const target = path.join(
  backupRoot,
  new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid,
);
await mkdir(target, { mode: 0o700 });
await writeFile(
  path.join(target, "INCOMPLETE"),
  "Do not restore this backup until manifest.json exists.\n",
  { mode: 0o600 },
);
const dumpPath = path.join(target, "database.sql");
const args = [
  "--single-transaction",
  "--quick",
  "--no-tablespaces",
  "--skip-lock-tables",
  "--hex-blob",
  "--host",
  process.env.DB_HOST || "127.0.0.1",
  "--port",
  process.env.DB_PORT || "3306",
  "--user",
  process.env.DB_USER || "root",
  "--databases",
  process.env.DB_NAME || "haskins_db",
];
const child = spawn("mysqldump", args, {
  env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" },
  stdio: ["ignore", "pipe", "pipe"],
});
// Never print stderr: a client configuration error could contain connection details.
child.stderr.resume();
const completed = new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) =>
    code === 0
      ? resolve()
      : reject(Error("mysqldump failed; backup is incomplete")),
  );
});
await Promise.all([
  completed,
  pipeline(child.stdout, createWriteStream(dumpPath, { mode: 0o600 })),
]);
const copied = [];
for (let index = 0; index < storage.length; index++) {
  try {
    await stat(storage[index]);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const name = index === 0 ? "uploads" : "private-tenant-files";
  await cp(storage[index], path.join(target, name), {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
  });
  copied.push(name);
}
const digest = createHash("sha256");
for await (const chunk of createReadStream(dumpPath)) digest.update(chunk);
await writeFile(
  path.join(target, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      createdAt: new Date().toISOString(),
      databaseSha256: digest.digest("hex"),
      directories: copied,
      keyBackupRequired:
        "MFA_ENCRYPTION_KEY must be retained separately in encrypted secret storage",
      consistency:
        "Pause application writes during backup for DB/file consistency",
    },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
console.log("Backup completed:", target);
await unlink(path.join(target, "INCOMPLETE"));
console.log(
  "Encrypt/copy off-host and verify a restore. Keep MFA_ENCRYPTION_KEY separately; this backup does not include .env.",
);
