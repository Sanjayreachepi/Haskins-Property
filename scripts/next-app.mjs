import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
const [app, mode, ...extra] = process.argv.slice(2);
if (!["web", "admin"].includes(app) || !["dev", "start"].includes(mode))
  throw Error("Usage: next-app.mjs web|admin dev|start");
const port = Number(
  process.env[app === "web" ? "WEB_PORT" : "ADMIN_PORT"] ||
    (app === "web" ? 3000 : 3001),
);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid application port");
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    mode,
    "--port",
    String(port),
    ...extra,
  ],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
