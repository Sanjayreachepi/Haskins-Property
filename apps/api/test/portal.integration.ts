import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { SMTPServer } from "smtp-server";
import { db, rows } from "../src/db";
import { passwordHash } from "../src/security";

const suffix = randomBytes(6).toString("hex"),
  password = randomBytes(20).toString("hex");
const apiPort = Number(process.env.PORTAL_TEST_API_PORT || 4011),
  smtpPort = Number(process.env.PORTAL_TEST_SMTP_PORT || 4026);
const base = `http://127.0.0.1:${apiPort}/api`,
  origin = "http://localhost:3001";
const files = `/tmp/haskins-portal-files-${suffix}`;
const userIds: number[] = [],
  recordIds: number[] = [],
  tenancyIds: number[] = [];
const emails: string[] = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  onData(stream, _session, done) {
    let data = "";
    stream.on("data", (chunk) => (data += chunk.toString()));
    stream.on("end", () => {
      emails.push(data);
      done();
    });
  },
});
let child: ReturnType<typeof spawn> | undefined;
async function request(path: string, cookie = "", method = "GET", body?: any) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = r.headers.get("content-type")?.includes("application/json")
    ? await r.json()
    : await r.text();
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    headers: r.headers,
  };
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function emailToken(index: number) {
  for (let i = 0; i < 100 && !emails[index]; i++) await pause(25);
  assert.ok(emails[index], "security email was captured locally");
  const body = emails[index]
    .replace(/=\r?\n/g, "")
    .replace(/=([a-f0-9]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  const token = body.match(/token=([a-f0-9]{64})/)?.[1];
  assert.ok(token, "email contains activation/reset link");
  return token;
}
async function tenantLogin(email: string, password: string) {
  const login = await request("/auth/login", "", "POST", { email, password });
  assert.equal(login.status, 200);
  assert.equal(login.data.role, "tenant");
  assert.ok(login.cookie.startsWith("hic_session="));
  assert.equal((await request("/admin/me", login.cookie)).status, 403);
  return login;
}
async function createUser(role: string) {
  const email = `portal-${role}-${userIds.length}-${suffix}@example.invalid`;
  const r: any = await rows(
    "INSERT INTO users(name,email,role,password_hash) VALUES (?,?,?,?)",
    ["Portal test " + role, email, role, passwordHash(password)],
  );
  userIds.push(r.insertId);
  return { id: r.insertId, email };
}
async function main() {
  await new Promise<void>((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(smtpPort, "127.0.0.1", resolve);
  });
  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(apiPort),
      PORT: String(apiPort),
      DEMO_LOGIN_OTP: "false",
      ADMIN_MFA_REQUIRED: "false",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASS: "",
      MAIL_FROM: "portal@example.invalid",
      INQUIRY_NOTIFY_TO: "test@example.invalid",
      ADMIN_ORIGIN: origin,
      WEB_ORIGIN: "http://localhost:3000",
      PRIVATE_DOCUMENT_DIR: files,
      NODE_ENV: "test",
      COOKIE_SECURE: "false",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let startupErrors = "";
  child.stderr?.on("data", (b) => (startupErrors += b.toString()));
  for (let i = 0; i < 100; i++) {
    try {
      const r = await request("/health");
      if (r.status === 200) break;
    } catch {}
    if (child.exitCode !== null)
      throw Error("Test API failed to start: " + startupErrors);
    if (i === 99) throw Error("Test API unavailable");
    await pause(100);
  }
  const admin = await createUser("admin"),
    tenant1 = await createUser("tenant"),
    tenant2 = await createUser("tenant");
  const a = await request("/admin/auth/login", "", "POST", {
    email: admin.email,
    password,
  });
  assert.equal(a.status, 200);
  assert.ok(a.cookie.startsWith("hic_admin_session="));
  const adminCookie = a.cookie;
  const t1 = (await tenantLogin(tenant1.email, password)).cookie;
  const t2 = (await tenantLogin(tenant2.email, password)).cookie;
  const user = await createUser("user");
  const u = await request("/auth/login", "", "POST", {
    email: user.email,
    password,
  });
  assert.equal((await request("/tenant/notices", u.cookie)).status, 403);
  assert.equal(
    (await request("/tenant/maintenance-tickets", u.cookie)).status,
    403,
  );
  const entity: any = await rows(
    "INSERT INTO cms_records(kind,slug,title,payload,published_slug,published_title,published_payload) VALUES ('entity',?,?, '{}',?,?, '{}')",
    [suffix + "-owner", "Portal owner", suffix + "-owner", "Portal owner"],
  );
  recordIds.push(entity.insertId);
  const property: any = await rows(
    "INSERT INTO cms_records(kind,slug,title,entity_id,published_entity_id,payload,published_slug,published_title,published_payload) VALUES ('property',?,?,?,?, '{}',?,?, '{}')",
    [
      suffix + "-property",
      "Portal property",
      entity.insertId,
      entity.insertId,
      suffix + "-property",
      "Portal property",
    ],
  );
  recordIds.push(property.insertId);
  for (const u of [tenant1, tenant2]) {
    const t: any = await rows(
      "INSERT INTO tenancies(user_id,property_id,reference) VALUES (?,?,?)",
      [u.id, property.insertId, "Unit " + u.id],
    );
    tenancyIds.push(t.insertId);
  }
  const [tenancy1, tenancy2] = tenancyIds;
  assert.equal((await request("/tenant/documents")).status, 401);
  assert.equal((await request("/admin/tenant-documents", t1)).status, 403);
  const pdf = new FormData();
  pdf.set("tenancy_id", String(tenancy1));
  pdf.set("title", "Private lease");
  pdf.set(
    "file",
    new Blob(["%PDF-1.4\nTest private PDF\n%%EOF"], {
      type: "application/pdf",
    }),
    "lease.pdf",
  );
  const doc = await request(
    "/admin/tenant-documents",
    adminCookie,
    "POST",
    pdf,
  );
  assert.equal(doc.status, 200);
  assert.equal((await request("/tenant/documents", t1)).data.length, 1);
  assert.equal((await request("/tenant/documents", t2)).data.length, 0);
  const downloaded = await request(
    `/tenant/documents/${doc.data.id}/download`,
    t1,
  );
  assert.equal(downloaded.status, 200);
  assert.ok(
    downloaded.headers.get("content-disposition")?.includes("attachment"),
  );
  assert.ok(downloaded.headers.get("cache-control")?.includes("no-store"));
  assert.equal(
    (await request(`/tenant/documents/${doc.data.id}/download`, t2)).status,
    404,
  );
  assert.equal(
    (await request(`/tenant/documents/${doc.data.id}/download`)).status,
    401,
  );
  const [storedDoc] = await rows(
    "SELECT filename FROM tenant_documents WHERE id=?",
    [doc.data.id],
  );
  assert.equal((await request("/media/" + storedDoc.filename)).status, 404);
  assert.equal(
    (
      await request(
        `/admin/tenant-documents/${doc.data.id}`,
        adminCookie,
        "PATCH",
        { active: false },
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(`/tenant/documents/${doc.data.id}/download`, t1)).status,
    404,
  );
  await request(
    `/admin/tenant-documents/${doc.data.id}`,
    adminCookie,
    "PATCH",
    { active: true },
  );
  const invalid = new FormData();
  invalid.set("tenancy_id", String(tenancy1));
  invalid.set("title", "Invalid");
  invalid.set("file", new Blob(["not a PDF"]), "fake.pdf");
  assert.equal(
    (await request("/admin/tenant-documents", adminCookie, "POST", invalid))
      .status,
    400,
  );
  const notice = await request("/admin/tenant-notices", adminCookie, "POST", {
    tenancy_id: tenancy1,
    title: "Access notice",
    content: "Only unit one sees this.",
  });
  assert.equal(notice.status, 200);
  assert.equal((await request("/tenant/notices", t1)).data.length, 1);
  assert.equal((await request("/tenant/notices", t2)).data.length, 0);
  await request(
    `/admin/tenant-notices/${notice.data.id}`,
    adminCookie,
    "PATCH",
    { active: false },
  );
  assert.equal((await request("/tenant/notices", t1)).data.length, 0);
  assert.equal(
    (
      await request("/tenant/maintenance-tickets", t2, "POST", {
        tenancy_id: tenancy1,
        subject: "Wrong tenancy",
        description: "Denied",
      })
    ).status,
    404,
  );
  const ticket = await request("/tenant/maintenance-tickets", t1, "POST", {
    tenancy_id: tenancy1,
    subject: "Roof leak",
    description: "Please inspect",
  });
  assert.equal(ticket.status, 200);
  assert.equal(
    (await request(`/tenant/maintenance-tickets/${ticket.data.id}`, t2)).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/tenant/maintenance-tickets/${ticket.data.id}/messages`,
        t2,
        "POST",
        { message: "Denied" },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/admin/maintenance-tickets/${ticket.data.id}`,
        t1,
        "PATCH",
        { status: "resolved" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/admin/maintenance-tickets/${ticket.data.id}`,
        adminCookie,
        "PATCH",
        { status: "in-progress" },
      )
    ).status,
    200,
  );
  await request(
    `/admin/maintenance-tickets/${ticket.data.id}/messages`,
    adminCookie,
    "POST",
    { message: "Inspection scheduled" },
  );
  const detail = await request(
    `/tenant/maintenance-tickets/${ticket.data.id}`,
    t1,
  );
  assert.equal(detail.data.status, "in-progress");
  assert.equal(detail.data.messages[0].author, "Management");
  await rows("UPDATE tenancies SET active=0 WHERE id=?", [tenancy1]);
  assert.equal(
    (await request(`/tenant/documents/${doc.data.id}/download`, t1)).status,
    404,
  );
  assert.equal(
    (await request(`/tenant/maintenance-tickets/${ticket.data.id}`, t1)).status,
    404,
  );
  await rows("UPDATE tenancies SET active=1 WHERE id=?", [tenancy1]);

  const inviteEmail = `portal-invite-${suffix}@example.invalid`;
  const invite = await request("/admin/users", adminCookie, "POST", {
    name: "Invited tenant",
    email: inviteEmail,
    role: "tenant",
    invite: true,
  });
  assert.equal(invite.status, 200);
  assert.equal(invite.data.emailed, true);
  assert.equal(
    invite.data.link,
    undefined,
    "delivered tokens are not returned",
  );
  userIds.push(invite.data.id);
  const activation = await emailToken(0);
  assert.equal(
    (await request("/auth/login", "", "POST", { email: inviteEmail, password }))
      .status,
    401,
  );
  assert.equal(
    (await request("/auth/reset", "", "POST", { token: activation, password }))
      .status,
    200,
  );
  assert.equal(
    (await request("/auth/reset", "", "POST", { token: activation, password }))
      .status,
    400,
  );
  const invitedLogin = await tenantLogin(inviteEmail, password);
  const reset = await request("/auth/forgot", "", "POST", {
    email: inviteEmail,
  });
  const unknown = await request("/auth/forgot", "", "POST", {
    email: `unknown-${suffix}@example.invalid`,
  });
  assert.equal(reset.data.message, unknown.data.message);
  const resetToken = await emailToken(1);
  const newPassword = randomBytes(20).toString("hex");
  const concurrent = await Promise.all([
    request("/auth/reset", "", "POST", {
      token: resetToken,
      password: newPassword,
    }),
    request("/auth/reset", "", "POST", {
      token: resetToken,
      password: newPassword,
    }),
  ]);
  assert.deepEqual(concurrent.map((v) => v.status).sort(), [200, 400]);
  assert.equal((await request("/auth/me", invitedLogin.cookie)).status, 401);
  assert.equal((await tenantLogin(inviteEmail, newPassword)).status, 200);
  console.log(
    "PASS: tenant document/notice isolation, private downloads and revocation, maintenance ownership/status/replies, inactive-tenancy denial, real SMTP invitations/reset, concurrent single-use reset and session revocation.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => {});
    }
    for (const id of tenancyIds) {
      await rows(
        "DELETE FROM maintenance_messages WHERE ticket_id IN (SELECT id FROM maintenance_tickets WHERE tenancy_id=?)",
        [id],
      );
      await rows("DELETE FROM maintenance_tickets WHERE tenancy_id=?", [id]);
      await rows("DELETE FROM tenant_documents WHERE tenancy_id=?", [id]);
      await rows("DELETE FROM tenant_notices WHERE tenancy_id=?", [id]);
      await rows("DELETE FROM tenancies WHERE id=?", [id]);
    }
    for (const id of recordIds.reverse())
      await rows("DELETE FROM cms_records WHERE id=?", [id]);
    for (const id of userIds) {
      await rows("DELETE FROM audit_log WHERE actor_id=?", [id]);
      await rows("DELETE FROM users WHERE id=?", [id]);
    }
    await rm(files, { recursive: true, force: true });
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    await db.end();
  });
