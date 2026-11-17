import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { db, rows } from "../src/db";
import { passwordHash } from "../src/security";

/**
 * Password reset and invitation links. Run against an API without SMTP configured
 * (the link is then returned to the administrator instead of being emailed).
 */
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
const ADMIN = process.env.ADMIN_ORIGIN || "http://localhost:3001";
const WEB = process.env.WEB_ORIGIN || "http://localhost:3000";

async function request(path: string, opts: { origin?: string; cookie?: string; method?: string; body?: unknown } = {}) {
  const r = await fetch(base + path, {
    method: opts.method || (opts.body === undefined ? "GET" : "POST"),
    headers: {
      Origin: opts.origin || ADMIN,
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: r.status, data: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] || "" };
}
const tokenOf = (link: string) => new URL(link).searchParams.get("token") || "";

async function main() {
  const suffix = randomBytes(6).toString("hex");
  const adminPass = randomBytes(20).toString("hex");
  const ids: number[] = [];
  const created: any = await rows(
    "INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'admin')",
    [`pw-admin-${suffix}@example.invalid`, passwordHash(adminPass), "Password test admin"],
  );
  ids.push(created.insertId);
  try {
    const admin = (await request("/admin/auth/login", { body: { email: `pw-admin-${suffix}@example.invalid`, password: adminPass } })).cookie;
    assert.ok(admin);

    // invitation: account without a password, link returned when email is not configured
    const email = `pw-tenant-${suffix}@example.invalid`;
    const invite = await request("/admin/users", { cookie: admin, body: { email, name: "Invited tenant", role: "tenant", invite: true } });
    assert.equal(invite.status, 200);
    ids.push(invite.data.id);
    assert.equal(invite.data.emailed, false);
    assert.match(invite.data.link, /^http.*\/reset-password\?token=[a-f0-9]{64}&invite=1$/);
    assert.ok(invite.data.link.startsWith(WEB), "tenants get a website link");
    const inviteToken = tokenOf(invite.data.link);

    // duplicate email refused; non-admins cannot send links
    assert.equal((await request("/admin/users", { cookie: admin, body: { email, name: "Dup", role: "tenant", invite: true } })).status, 400);
    assert.equal((await request(`/admin/users/${invite.data.id}/link`, { body: { purpose: "reset" } })).status, 401);

    // the invited account cannot sign in before choosing a password
    const site = { origin: WEB };
    assert.equal((await request("/auth/reset", { ...site, body: { token: inviteToken, password: "short" } })).status, 400);
    const pw = "invited-" + randomBytes(8).toString("hex");
    const accept = await request("/auth/reset", { ...site, body: { token: inviteToken, password: pw } });
    assert.equal(accept.status, 200);
    assert.equal((await request("/auth/reset", { ...site, body: { token: inviteToken, password: pw } })).status, 400, "links work once");
    const tenantLogin = await request("/auth/login", { ...site, body: { email, password: pw } });
    assert.equal(tenantLogin.status, 200);

    // forgot password: same answer whether or not the account exists
    const known = await request("/auth/forgot", { ...site, body: { email } });
    const unknown = await request("/auth/forgot", { ...site, body: { email: `nobody-${suffix}@example.invalid` } });
    assert.equal(known.status, 200);
    assert.deepEqual(known.data, unknown.data);
    const [t] = await rows("SELECT purpose FROM password_tokens WHERE user_id=?", [invite.data.id]);
    assert.equal(t.purpose, "reset");
    // the admin panel's forgot form never issues links for non-admin accounts
    await rows("DELETE FROM password_tokens WHERE user_id=?", [invite.data.id]);
    await request("/admin/auth/forgot", { body: { email } });
    assert.equal((await rows("SELECT id FROM password_tokens WHERE user_id=?", [invite.data.id])).length, 0);

    // reset link from the admin: resetting signs the account out everywhere
    const reset = await request(`/admin/users/${invite.data.id}/link`, { cookie: admin, body: { purpose: "reset" } });
    assert.equal(reset.status, 200);
    const pw2 = "reset-" + randomBytes(8).toString("hex");
    assert.equal((await request("/auth/reset", { ...site, body: { token: tokenOf(reset.data.link), password: pw2 } })).status, 200);
    assert.equal((await request("/auth/me", { ...site, cookie: tenantLogin.cookie })).status, 401, "old session revoked");
    assert.equal((await request("/auth/login", { ...site, body: { email, password: pw } })).status, 401, "old password rejected");
    assert.equal((await request("/auth/login", { ...site, body: { email, password: pw2 } })).status, 200);

    // expired links are refused
    const again = await request(`/admin/users/${invite.data.id}/link`, { cookie: admin, body: { purpose: "reset" } });
    await rows("UPDATE password_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE user_id=?", [invite.data.id]);
    assert.equal((await request("/auth/reset", { ...site, body: { token: tokenOf(again.data.link), password: pw2 + "x" } })).status, 400);

    // admin accounts get an admin-panel link
    const adminLink = await request(`/admin/users/${ids[0]}/link`, { cookie: admin, body: { purpose: "reset" } });
    assert.ok(adminLink.data.link.startsWith(ADMIN));

    // Website users get their own account destination, not the tenant-only portal.
    const userEmail = `user-invite-${suffix}@example.invalid`;
    const userInvite = await request("/admin/users", { cookie: admin, body: { email: userEmail, name: "Invited user", role: "user", invite: true } });
    assert.equal(userInvite.status, 200);
    ids.push(userInvite.data.id);
    assert.equal(new URL(userInvite.data.link).searchParams.get("account"), "1");
    assert.equal((await request("/auth/reset", { ...site, body: { token: tokenOf(userInvite.data.link), password: pw } })).data.role, "user");
    const userLogin = await request("/auth/login", { ...site, body: { email: userEmail, password: pw } });
    assert.equal(userLogin.data.role, "user");
    assert.equal((await request("/tenant/tenancies", { ...site, cookie: userLogin.cookie })).status, 403);
    assert.equal((await request("/admin/me", { cookie: userLogin.cookie })).status, 403);

    console.log("PASS: invitations, one-time links, expiry, forgot-password privacy, admin-only admin resets, session revocation on reset");
  } finally {
    for (const id of ids) {
      await rows("DELETE FROM sessions WHERE user_id=?", [id]);
      await rows("DELETE FROM password_tokens WHERE user_id=?", [id]);
    }
    for (const id of ids) await rows("DELETE FROM audit_log WHERE actor_id=?", [id]);
    for (const id of ids.slice().reverse()) await rows("DELETE FROM users WHERE id=?", [id]);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
