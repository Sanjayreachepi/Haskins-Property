import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { db, rows } from "../src/db";
import { passwordHash } from "../src/security";
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
const origin = process.env.ADMIN_ORIGIN || "http://localhost:3001";
async function request(
  path: string,
  token = "",
  method = "GET",
  body?: unknown,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Cookie: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    token: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function main() {
  const suffix = randomBytes(8).toString("hex"),
    password = randomBytes(20).toString("hex"),
    ids: number[] = [],
    contentIds: number[] = [];
  const adminEmail = `rbac-admin-${suffix}@example.invalid`;
  const created: any = await rows(
    "INSERT INTO users(email,password_hash,name,role) VALUES (?,?,?,'admin')",
    [adminEmail, passwordHash(password), "Role test administrator"],
  );
  ids.push(created.insertId);
  try {
    const login = await request("/auth/login", "", "POST", {
      email: adminEmail,
      password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.role, "admin");
    const admin = login.token;
    const [defaultAdmin] = await rows(
      "SELECT role,password_hash FROM users WHERE email='admin@gmail.com'",
    );
    assert.equal(defaultAdmin.role, "admin");
    const { scryptSync, timingSafeEqual } = await import("node:crypto");
    const [salt, stored] = defaultAdmin.password_hash.split(":");
    assert.ok(
      timingSafeEqual(
        scryptSync("admin@123", salt, 64),
        Buffer.from(stored, "hex"),
      ),
    );
    const [properties] = await Promise.all([request("/public/content")]);
    const property = properties.data.find((r: any) => r.kind === "property");
    assert.ok(property);
    async function create(role: string) {
      const email = `rbac-${role}-${ids.length}-${suffix}@example.invalid`;
      const r = await request("/admin/users", admin, "POST", {
        email,
        name: "Test " + role,
        role,
        password,
      });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      ids.push(r.data.id);
      const login = await request("/auth/login", "", "POST", {
        email,
        password,
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.role, role);
      return { id: r.data.id, email, token: login.token };
    }
    const user = await create("user"),
      tenant1 = await create("tenant"),
      tenant2 = await create("tenant");
    // Cookies are shared across localhost ports: each workspace must retain its own session.
    const adminLogin = await request("/admin/auth/login", "", "POST", {
      email: adminEmail, password,
    });
    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.token.startsWith("hic_admin_session="));
    const tenantLogin = await request("/auth/login", "", "POST", {
      email: tenant1.email, password,
    });
    assert.equal(tenantLogin.status, 200);
    assert.ok(tenantLogin.token.startsWith("hic_session="));
    const both = adminLogin.token + "; " + tenantLogin.token;
    assert.equal((await request("/admin/me", both)).data.email, adminEmail);
    assert.equal((await request("/admin/media", both)).status, 200);
    assert.equal((await request("/auth/me", both)).data.id, tenant1.id);
    assert.equal((await request("/auth/logout", both, "POST", {})).status, 200);
    assert.equal((await request("/admin/me", both)).status, 200);
    assert.equal((await request("/auth/me", both)).status, 401);
    // The original tenant session remains valid when the admin signs out.
    const originalTenantAndAdmin = adminLogin.token + "; " + tenant1.token;
    assert.equal((await request("/admin/auth/logout", originalTenantAndAdmin, "POST", {})).status, 200);
    assert.equal((await request("/admin/me", originalTenantAndAdmin)).status, 401);
    assert.equal((await request("/auth/me", originalTenantAndAdmin)).data.id, tenant1.id);
    assert.equal((await request("/admin/auth/login", "", "POST", {
      email: tenant1.email, password,
    })).status, 403);
    for (const actor of [user, tenant1, tenant2]) {
      for (const path of [
        "/admin/me",
        "/admin/records",
        "/admin/users",
        "/admin/tenancies",
        "/admin/media",
        "/admin/audit",
        "/admin/inquiries",
      ])
        assert.equal((await request(path, actor.token)).status, 403, path);
      assert.equal(
        (await request("/admin/records", actor.token, "POST", { kind: "page" }))
          .status,
        403,
      );
      assert.equal((await request("/account/me", actor.token)).status, 200);
      assert.equal((await request("/auth/me", actor.token)).status, 200);
    }
    assert.equal((await request("/tenant/tenancies", user.token)).status, 403);
    assert.equal(
      (
        await request("/account/profile", user.token, "PATCH", {
          name: "Updated name",
          role: "admin",
          id: tenant1.id,
        })
      ).status,
      200,
    );
    assert.equal((await request("/auth/me", user.token)).data.role, "user");
    assert.equal(
      (await request("/tenant/tenancies", tenant1.token)).data.length,
      0,
    );
    const payment = await request("/admin/records", admin, "POST", {
      kind: "payment",
      slug: "test-role-payment-" + suffix,
      title: "Test private instructions",
      property_id: property.id,
      payload: {
        payee: property.owner,
        instructions: "TEST private instructions",
        method: "Test",
      },
    });
    assert.equal(payment.status, 200);
    contentIds.push(payment.data.id);
    assert.equal(
      (
        await request(
          `/admin/records/${payment.data.id}/publish`,
          admin,
          "POST",
          { confirmPayee: true },
        )
      ).status,
      200,
    );
    async function assign(userId: number, paymentId: number | null) {
      const r = await request("/admin/tenancies", admin, "POST", {
        user_id: userId,
        property_id: property.id,
        payment_record_id: paymentId,
        reference: "Unit-" + suffix,
      });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data.id;
    }
    const first = await assign(tenant1.id, payment.data.id),
      second = await assign(tenant2.id, null);
    const t1 = await request("/tenant/tenancies", tenant1.token),
      t2 = await request("/tenant/tenancies", tenant2.token);
    assert.deepEqual(
      t1.data.map((t: any) => t.id),
      [first],
    );
    assert.deepEqual(
      t2.data.map((t: any) => t.id),
      [second],
    );
    assert.equal(t1.data[0].owner, property.owner);
    assert.equal(t1.data[0].payment.instructions, "TEST private instructions");
    assert.equal(t2.data[0].payment, null);
    assert.equal(
      (await request("/tenant/tenancies/" + first, tenant2.token)).status,
      404,
    );
    assert.equal(
      (await request("/tenant/tenancies/" + second, tenant1.token)).status,
      404,
    );
    assert.equal(
      (
        await request("/admin/tenancies", admin, "POST", {
          user_id: user.id,
          property_id: property.id,
          reference: "invalid",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/admin/tenancies/" + first, admin, "PATCH", {
          active: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/tenant/tenancies/" + first, tenant1.token)).status,
      404,
    );
    assert.equal(
      (
        await request("/admin/users/" + tenant2.id, admin, "PATCH", {
          name: "Changed role",
          role: "user",
          active: true,
        })
      ).status,
      200,
    );
    assert.equal((await request("/auth/me", tenant2.token)).status, 401);
    const demoted = await request("/auth/login", "", "POST", {
      email: tenant2.email,
      password,
    });
    assert.equal(demoted.data.role, "user");
    assert.equal(
      (await request("/tenant/tenancies", demoted.token)).status,
      403,
    );
    assert.equal(
      (
        await request("/admin/users/" + user.id, admin, "PATCH", {
          name: "Disabled user",
          role: "user",
          active: false,
        })
      ).status,
      200,
    );
    assert.equal((await request("/auth/me", user.token)).status, 401);
    assert.equal(
      (
        await request("/auth/login", "", "POST", {
          email: user.email,
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/admin/users/" + ids[0], admin, "PATCH", {
          name: "Role test administrator",
          role: "user",
          active: true,
        })
      ).status,
      400,
    );
    const accountList = await request("/admin/users", admin);
    assert.ok(
      accountList.data.every((u: any) => u.password_hash === undefined),
    );
    console.log(
      "PASS: default admin password hash, all three roles, admin route protection, self-service scope, tenant isolation, explicit payment assignment, inactive tenancies, role-change session revocation, disabled accounts and self-demotion protection",
    );
  } finally {
    for (const id of ids)
      await rows("DELETE FROM tenancies WHERE user_id=?", [id]);
    for (const id of contentIds)
      await rows("DELETE FROM cms_records WHERE id=?", [id]);
    for (const id of ids)
      await rows("DELETE FROM audit_log WHERE actor_id=?", [id]);
    for (const id of ids) await rows("DELETE FROM users WHERE id=?", [id]);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
