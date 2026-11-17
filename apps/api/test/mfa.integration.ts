import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { db, rows } from "../src/db";
import { passwordHash } from "../src/security";
import { totp } from "../src/mfa";

/** Two-step sign-in for administrators. */
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
const ADMIN = process.env.ADMIN_ORIGIN || "http://localhost:3001";
const WEB = process.env.WEB_ORIGIN || "http://localhost:3000";

async function request(path: string, opts: { origin?: string; cookie?: string; body?: unknown } = {}) {
  const r = await fetch(base + path, {
    method: opts.body === undefined ? "GET" : "POST",
    headers: { Origin: opts.origin || ADMIN, "Content-Type": "application/json", ...(opts.cookie ? { Cookie: opts.cookie } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: r.status, data: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] || "" };
}
const step = () => Math.floor(Date.now() / 30_000);
const clean = (s: string) => s.replace(/\s/g, "");

async function main() {
  const suffix = randomBytes(6).toString("hex");
  const ids: number[] = [];
  const mk = async (label: string) => {
    const email = `mfa-${label}-${suffix}@example.invalid`, password = randomBytes(16).toString("hex");
    const r: any = await rows("INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'admin')", [email, passwordHash(password), "MFA " + label]);
    ids.push(r.insertId);
    return { id: r.insertId as number, email, password };
  };
  const a = await mk("a"), b = await mk("b");
  try {
    const login = (u: { email: string; password: string }, origin = ADMIN) =>
      request(origin === ADMIN ? "/admin/auth/login" : "/auth/login", { origin, body: { email: u.email, password: u.password } });

    // set up
    const s1 = await login(a);
    assert.equal(s1.status, 200);
    assert.ok(s1.cookie, "no MFA yet: signed in directly");
    const me0 = await request("/admin/me", { cookie: s1.cookie });
    assert.equal(me0.data.mfaEnabled, false);
    const setup = await request("/admin/mfa/setup", { cookie: s1.cookie, body: {} });
    assert.equal(setup.status, 200);
    assert.match(setup.data.qr, /^data:image\/png;base64,/);
    assert.match(setup.data.uri, /^otpauth:\/\/totp\//);
    const secret = clean(setup.data.secret);
    const [stored] = await rows("SELECT mfa_secret FROM users WHERE id=?", [a.id]);
    assert.ok(stored.mfa_secret.startsWith("v1:") && !stored.mfa_secret.includes(secret), "secret encrypted at rest");
    assert.equal((await request("/admin/mfa/enable", { cookie: s1.cookie, body: { code: "000000" } })).status, 400);
    const on = await request("/admin/mfa/enable", { cookie: s1.cookie, body: { code: totp(secret, step()) } });
    assert.equal(on.status, 200);
    assert.equal(on.data.recoveryCodes.length, 10);

    // sign-in now needs a code
    const s2 = await login(a);
    assert.equal(s2.data.mfaRequired, true);
    assert.equal(s2.cookie, "", "no session before the code");
    assert.equal((await request("/admin/auth/mfa", { body: { challenge: s2.data.challenge, code: "123456" } })).status, 401);
    // the code used to switch MFA on cannot be replayed
    assert.equal((await request("/admin/auth/mfa", { body: { challenge: s2.data.challenge, code: totp(secret, step()) } })).status, 401);
    // next time step works (clock drift window), and only once
    const next = totp(secret, step() + 1);
    const ok = await request("/admin/auth/mfa", { body: { challenge: s2.data.challenge, code: next } });
    assert.equal(ok.status, 200);
    assert.ok(ok.cookie.startsWith("hic_admin_session="));
    assert.equal((await request("/admin/me", { cookie: ok.cookie })).data.mfaEnabled, true);
    const s3 = await login(a);
    assert.equal((await request("/admin/auth/mfa", { body: { challenge: s3.data.challenge, code: next } })).status, 401, "code reuse blocked");

    // recovery code works once
    const rc = on.data.recoveryCodes[0];
    const r1 = await request("/admin/auth/mfa", { body: { challenge: s3.data.challenge, code: rc.toUpperCase() } });
    assert.equal(r1.status, 200);
    const s4 = await login(a);
    assert.equal((await request("/admin/auth/mfa", { body: { challenge: s4.data.challenge, code: rc } })).status, 401);
    // 5 wrong tries end the challenge
    for (let i = 0; i < 4; i++) await request("/admin/auth/mfa", { body: { challenge: s4.data.challenge, code: "000000" } });
    assert.equal((await request("/admin/auth/mfa", { body: { challenge: s4.data.challenge, code: on.data.recoveryCodes[1] } })).status, 429);

    // the website login cannot be used to skip the code
    assert.equal((await login(a, WEB)).status, 403);

    // turning off needs password + code
    assert.equal((await request("/admin/mfa/disable", { cookie: ok.cookie, body: { password: "wrong", code: on.data.recoveryCodes[2] } })).status, 400);

    // another admin can reset a colleague's MFA (lost phone); this signs them out
    const sb = await login(b);
    // A forgotten password never disables the authenticator requirement.
    const reset = await request(`/admin/users/${a.id}/link`, { cookie: sb.cookie, body: { purpose: "reset" } });
    assert.equal(reset.status, 200);
    const newPassword = randomBytes(16).toString("hex");
    const resetResult = await request("/admin/auth/reset", { body: { token: new URL(reset.data.link).searchParams.get("token"), password: newPassword } });
    assert.equal(resetResult.status, 200);
    a.password = newPassword;
    assert.equal((await request("/admin/me", { cookie: ok.cookie })).status, 401);
    assert.equal((await login(a)).data.mfaRequired, true, "password reset preserves MFA");
    assert.equal((await request(`/admin/users/${b.id}/mfa-reset`, { cookie: sb.cookie, body: {} })).status, 400, "not on yourself");
    assert.equal((await request(`/admin/users/${a.id}/mfa-reset`, { cookie: sb.cookie, body: {} })).status, 200);
    assert.equal((await request("/admin/me", { cookie: ok.cookie })).status, 401);
    const s5 = await login(a);
    assert.ok(s5.cookie && !s5.data.mfaRequired, "after reset: password only");
    const users = await request("/admin/users", { cookie: sb.cookie });
    assert.equal(users.data.find((u: any) => u.id === a.id).mfa_enabled, 0);
    assert.ok(users.data.every((u: any) => u.mfa_secret === undefined));

    console.log("PASS: MFA set-up, encrypted secret, code step at sign-in, replay protection, recovery codes, attempt limit, website-login bypass blocked, disable checks, admin reset");
  } finally {
    for (const id of ids) {
      await rows("DELETE FROM sessions WHERE user_id=?", [id]);
      await rows("DELETE FROM audit_log WHERE actor_id=?", [id]);
    }
    for (const id of ids) await rows("DELETE FROM users WHERE id=?", [id]);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
