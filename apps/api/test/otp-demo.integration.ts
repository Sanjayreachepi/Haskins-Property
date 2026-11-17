import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { db, rows } from "../src/db";
import { passwordHash } from "../src/security";
const port = Number(process.env.OTP_DEMO_TEST_PORT || 4012),
  base = `http://127.0.0.1:${port}/api`;
let child: ReturnType<typeof spawn> | undefined,
  userId = 0,
  tenantId = 0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function call(path: string, body: any) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: {
      Origin: "http://localhost:3001",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie"),
  };
}
async function main() {
  const email = `demo-otp-${randomBytes(8).toString("hex")}@example.invalid`,
    password = randomBytes(20).toString("hex");
  const result: any = await rows(
    "INSERT INTO users(name,email,role,password_hash) VALUES (?,?,'admin',?)",
    ["OTP demo", email, passwordHash(password)],
  );
  userId = result.insertId;
  child = spawn(process.execPath, ["dist/main.js"], {
    env: {
      ...process.env,
      API_PORT: String(port),
      NODE_ENV: "development",
      DEMO_LOGIN_OTP: "true",
      SMTP_HOST: "",
      ADMIN_ORIGIN: "http://localhost:3001",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/health")).ok) break;
    } catch {}
    if (i === 99 || child.exitCode !== null)
      throw Error("Demo API unavailable");
    await pause(100);
  }
  const first = await call("/admin/auth/login", { email, password });
  assert.equal(first.status, 200);
  assert.equal(first.data.otpRequired, true);
  assert.match(first.data.developmentCode, /^\d{6}$/);
  assert.equal(first.cookie, null);
  const verified = await call("/admin/auth/verify-otp", {
    challenge: first.data.challenge,
    code: first.data.developmentCode,
  });
  assert.equal(verified.status, 200);
  assert.ok(verified.cookie?.startsWith("hic_admin_session="));
  assert.equal(
    (
      await call("/admin/auth/verify-otp", {
        challenge: first.data.challenge,
        code: first.data.developmentCode,
      })
    ).status,
    401,
  );
  const tenantEmail = `tenant-${email}`;
  const tenant: any = await rows(
    "INSERT INTO users(name,email,role,password_hash) VALUES (?,?,'tenant',?)",
    ["Tenant OTP demo", tenantEmail, passwordHash(password)],
  );
  tenantId = tenant.insertId;
  const t = await call("/auth/login", { email: tenantEmail, password });
  assert.equal(t.data.otpRequired, true);
  assert.match(t.data.developmentCode, /^\d{6}$/);
  assert.equal(t.cookie, null);
  assert.equal(
    (
      await call("/admin/auth/verify-otp", {
        challenge: t.data.challenge,
        code: t.data.developmentCode,
      })
    ).status,
    403,
  );
  const tv = await call("/auth/verify-otp", {
    challenge: t.data.challenge,
    code: t.data.developmentCode,
  });
  assert.equal(tv.status, 200);
  assert.equal(tv.data.role, "tenant");
  assert.ok(tv.cookie?.startsWith("hic_session="));
  assert.equal(
    (
      await call("/auth/verify-otp", {
        challenge: t.data.challenge,
        code: t.data.developmentCode,
      })
    ).status,
    401,
  );
  child.kill();
  await once(child, "exit");
  child = undefined;
  const production = spawn(process.execPath, ["dist/main.js"], {
    env: { ...process.env, NODE_ENV: "production", DEMO_LOGIN_OTP: "true" },
    stdio: "ignore",
  });
  const exit = await Promise.race([
    once(production, "exit"),
    pause(10000).then(() => {
      production.kill();
      throw Error("Production guard did not stop demo mode");
    }),
  ]);
  assert.equal(exit[0], 1);
  console.log(
    "PASS: admin/tenant development OTP displayed without SMTP, password-only login denied, code verification/single-use and production demo-mode rejection.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    for (const id of [userId, tenantId].filter(Boolean)) {
      await rows("DELETE FROM audit_log WHERE actor_id=?", [id]);
      await rows("DELETE FROM users WHERE id=?", [id]);
    }
    await db.end();
  });
