import { strict as assert } from "node:assert";
import { randomBytes, scryptSync } from "node:crypto";
import { db, rows } from "../src/db";
const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
const origin = process.env.ADMIN_ORIGIN || "http://localhost:3001";
async function main() {
  const suffix = randomBytes(8).toString("hex"),
    email = `test-${suffix}@example.invalid`,
    password = randomBytes(24).toString("hex"),
    salt = randomBytes(16).toString("hex");
  const created: any = await rows(
    "INSERT INTO users(email,password_hash,role) VALUES (?,?,'admin')",
    [email, salt + ":" + scryptSync(password, salt, 64).toString("hex")],
  );
  let token = "";
  const ids: number[] = [];
  let filename = "";
  let inquiryId: number | undefined;
  async function call(
    url: string,
    method = "GET",
    body?: any,
    cookie = true,
    requestOrigin = origin,
  ) {
    const r = await fetch(base + url, {
      method,
      headers: {
        Origin: requestOrigin,
        "Content-Type": "application/json",
        ...(cookie && token ? { Cookie: token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  try {
    assert.equal((await call("/admin/records")).status, 401);
    assert.equal(
      (
        await call(
          "/auth/login",
          "POST",
          { email, password },
          false,
          "https://untrusted.invalid",
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("/auth/login", "POST", { email, password: "incorrect" }))
        .status,
      401,
    );
    const login = await call("/auth/login", "POST", { email, password });
    assert.equal(login.status, 200);
    token = login.headers.get("set-cookie")!.split(";")[0];
    assert.ok(login.headers.get("set-cookie")!.includes("HttpOnly"));
    const initial = await call("/public/content");
    assert.ok(initial.data.every((r: any) => r.kind !== "payment"));
    async function create(
      kind: string,
      title: string,
      payload: any,
      relations: any = {},
    ) {
      const result = await call("/admin/records", "POST", {
        kind,
        title,
        slug: `test-${kind}-${ids.length}-${suffix}`,
        payload,
        ...relations,
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      ids.push(result.data.id);
      return result.data.id;
    }
    const e1 = await create("entity", "Test Owner A", {});
    const e2 = await create("entity", "Test Owner B", {});
    for (const id of [e1, e2])
      assert.equal(
        (await call(`/admin/records/${id}/publish`, "POST", {})).status,
        200,
      );
    assert.equal(
      (
        await call("/admin/records", "POST", {
          kind: "property",
          title: "Invalid",
          slug: "invalid-" + suffix,
          payload: {},
        })
      ).status,
      400,
    );
    const property = await create(
      "property",
      "Test Property",
      {
        description: "Original published description",
        image: "/images/logo.png",
      },
      { entity_id: e1 },
    );
    assert.ok(
      !(await call("/public/content")).data.find((r: any) => r.id === property),
    );
    assert.equal(
      (await call(`/admin/records/${property}/publish`, "POST", {})).status,
      200,
    );
    assert.equal(
      (
        await call("/admin/records", "POST", {
          id: property,
          kind: "property",
          title: "Changed draft title",
          slug: "test-property-2-" + suffix,
          entity_id: e2,
          payload: { description: "Changed draft description" },
        })
      ).status,
      200,
    );
    const live = (await call("/public/content")).data.find(
      (r: any) => r.id === property,
    );
    assert.equal(live.title, "Test Property");
    assert.equal(live.owner, "Test Owner A");
    assert.equal(live.payload.description, "Original published description");
    assert.equal(
      (await call(`/admin/records/${e1}/unpublish`, "POST", {})).status,
      400,
    );
    const payment = await create(
      "payment",
      "Private payment",
      { payee: "Test Owner A", instructions: "Private test instructions" },
      { property_id: property },
    );
    assert.equal(
      (await call(`/admin/records/${payment}/publish`, "POST", {})).status,
      400,
    );
    assert.equal(
      (
        await call(`/admin/records/${payment}/publish`, "POST", {
          confirmPayee: true,
        })
      ).status,
      200,
    );
    assert.ok(
      !(await call("/public/content")).data.find((r: any) => r.id === payment),
    );
    assert.equal(
      (
        await call(
          "/public/inquiries",
          "POST",
          {
            name: "Test",
            email: "bad-email",
            category: "General inquiry",
            message: "Test message",
          },
          false,
          process.env.WEB_ORIGIN || "http://localhost:3000",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/public/inquiries",
          "POST",
          {
            name: "Integration " + suffix,
            email,
            category: "Space inquiry",
            property: "test-property-2-" + suffix,
            message: "Please confirm available space.",
          },
          false,
          process.env.WEB_ORIGIN || "http://localhost:3000",
        )
      ).status,
      200,
    );
    const inquiry = (await call("/admin/inquiries")).data.find(
      (i: any) => i.email === email,
    );
    assert.ok(inquiry);
    inquiryId = inquiry.id;
    assert.equal(
      (
        await call("/admin/inquiries/" + inquiry.id, "PATCH", {
          status: "resolved",
        })
      ).status,
      200,
    );
    const badForm = new FormData();
    badForm.set(
      "file",
      new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/svg+xml" }),
      "bad.svg",
    );
    const badUpload = await fetch(base + "/admin/media", {
      method: "POST",
      headers: { Origin: origin, Cookie: token },
      body: badForm,
    });
    assert.equal(badUpload.status, 400);
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2m5sAAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        { type: "image/png" },
      ),
      "test.png",
    );
    form.set("alt", "Integration image");
    const upload = await fetch(base + "/admin/media", {
      method: "POST",
      headers: { Origin: origin, Cookie: token },
      body: form,
    });
    assert.equal(upload.status, 200);
    const uploaded: any = await upload.json();
    filename = uploaded.url.split("/").pop();
    const served = await fetch(base + "/media/" + filename);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");
    assert.equal((await call("/auth/logout", "POST", {})).status, 200);
    assert.equal((await call("/admin/records")).status, 401);
    console.log(
      "PASS: login, origin protection, unauthenticated access, draft isolation, published ownership, dependency protection, private payment publishing, inquiry validation/inbox, upload validation, media serving and logout",
    );
  } finally {
    if (inquiryId) await rows("DELETE FROM inquiries WHERE id=?", [inquiryId]);
    for (const id of ids.reverse())
      await rows("DELETE FROM cms_records WHERE id=?", [id]);
    await rows("DELETE FROM audit_log WHERE actor_id=?", [created.insertId]);
    await rows("DELETE FROM users WHERE id=?", [created.insertId]);
    if (filename) {
      await rows("DELETE FROM media WHERE filename=?", [filename]);
      const { unlink } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      await unlink(resolve(process.env.UPLOAD_DIR || "uploads", filename));
    }
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
