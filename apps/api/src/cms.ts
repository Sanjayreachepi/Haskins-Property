import { fontChoices, numberRanges } from "@haskins/shared/design-tokens.json";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { rows } from "./db";
import {
  hash,
  fail,
  wrap,
  cookie,
  authenticate,
  audit,
  text,
  secret,
  requireRole,
  sessionCookie,
  sessionCookieName,
} from "./security";
import { registerAccounts } from "./accounts";
import { registerTenantServices } from "./tenant-services";
import { registerPasswordReset } from "./password-reset";
import { MFA_SETUP_PATHS, mfaEnabled, mfaRequired, registerMfaAccount, registerMfaLogin, startChallenge } from "./mfa";

/** Starts an 8-hour session and sets the cookie (password login, or after the two-step code). */
async function createSession(res: Response, user: { id: number }, cookieName: string) {
  await rows("DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP()");
  const token = randomBytes(32).toString("hex");
  await rows(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))",
    [hash(token), user.id],
  );
  res.cookie(cookieName, token, { ...sessionCookie(), maxAge: 28800000 });
}
import { notifyInquiry } from "./mail";
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
const kinds = ["entity", "property", "page", "space", "settings", "payment"];
const attempts = new Map<string, { count: number; until: number }>();
const fontKeys = Object.values(fontChoices).flatMap((choices) => choices.map((font) => font.key));
const LINK_RE = /^(\/[a-zA-Z0-9\-._~\/#?=&%]*|https:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:[+0-9() .-]+)$/;
/** Validate a page block by the kind of value its key stands for (images, links, colors, fonts, numbers). */
function blockValue(key: string, v: string): string {
  if (!v) return v;
  if (/Image$/.test(key) && !/^\/(images|api\/media)\/[a-zA-Z0-9._-]+$/.test(v))
    throw fail("Choose a local library image (" + key + ")");
  if (/Url$/.test(key) && !LINK_RE.test(v))
    throw fail("Links must start with / or https:// (" + key + ")");
  if (/^color[A-Z]/.test(key) && !/^#[0-9a-fA-F]{6}$/.test(v))
    throw fail("Colors must look like #f2a900 (" + key + ")");
  if (/^font[A-Z]/.test(key) && !fontKeys.includes(v)) throw fail("Unknown font (" + key + ")");
  if (/^num[A-Z]/.test(key)) {
    const n = Number(v);
    const r = (numberRanges as Record<string, number[]>)[key];
    if (!Number.isFinite(n) || (r && (n < r[0] || n > r[1])))
      throw fail("Number out of range (" + key + ")");
  }
  return v;
}

function payload(input: any) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw fail("Invalid content");
  const out: any = {};
  for (const key of [
    "description",
    "content",
    "type",
    "location",
    "image",
    "imageAlt",
    "seoTitle",
    "seoDescription",
    "canonical",
    "ogImage",
    "targetPhrase",
    "legalName",
    "contactEmail",
    "contactPhone",
    "address",
    "payee",
    "instructions",
    "method",
    "ownershipNote",
    "ownershipShare",
    // site-wide SEO + business profile (Site settings)
    "seoSiteName",
    "seoDefaultDescription",
    "seoDefaultImage",
    "orgLogo",
    "socialLinks",
    "twitterHandle",
    "googleVerification",
    "bingVerification",
    "redirects",
  ])
    out[key] = text(input[key], key === "content" ? 50000 : key === "redirects" ? 20000 : 5000);
  for (const key of ["gallery", "documents"]) {
    if (input[key] !== undefined && !Array.isArray(input[key]))
      throw fail("Invalid media collection");
    out[key] = (input[key] || []).slice(0, 30).map((item: any) => {
      const url = text(item?.url, 300);
      if (!/^\/(images|api\/media)\/[a-zA-Z0-9._-]+$/.test(url))
        throw fail("Choose a local media file");
      return { url, alt: text(item?.alt, 500), title: text(item?.title, 255) };
    });
  }
  // named text blocks for fixed-layout pages (see packages/shared/src/page-blocks.ts)
  if (input.blocks !== undefined) {
    if (!input.blocks || typeof input.blocks !== "object" || Array.isArray(input.blocks))
      throw fail("Invalid page text");
    out.blocks = {};
    for (const [k, v] of Object.entries(input.blocks).slice(0, 300)) {
      if (!/^[a-zA-Z0-9_]{1,60}$/.test(k)) throw fail("Invalid page text key");
      out.blocks[k] = blockValue(k, text(v, 5000));
    }
  }
  out.noindex = input.noindex === true;
  out.landOnly = input.landOnly === true; // entity owns the land, not the building
  for (const key of ["image", "ogImage", "seoDefaultImage", "orgLogo"])
    if (out[key] && !/^\/(images|api\/media)\/[a-zA-Z0-9._-]+$/.test(out[key]))
      throw fail("Choose a local library image");
  for (const key of ["googleVerification", "bingVerification"])
    if (out[key] && !/^[A-Za-z0-9_-]{8,200}$/.test(out[key]))
      throw fail("Verification codes may contain only letters, numbers, - and _");
  if (out.twitterHandle && !/^@?[A-Za-z0-9_]{1,15}$/.test(out.twitterHandle))
    throw fail("Enter the X/Twitter handle, e.g. @haskins");
  if (out.socialLinks) {
    for (const line of out.socialLinks.split("\n").map((l: string) => l.trim()).filter(Boolean)) {
      try {
        if (new URL(line).protocol !== "https:") throw Error();
      } catch {
        throw fail("Each social profile must be a full https:// URL on its own line");
      }
    }
  }
  if (out.canonical) {
    try {
      const u = new URL(out.canonical);
      if (u.protocol !== "https:") throw Error();
    } catch {
      throw fail("Canonical must be an absolute HTTPS URL");
    }
  }
  return out;
}
export async function registerCms(server: express.Express) {
  await mkdir(uploadDir, { recursive: true });
  const origins = [
    process.env.WEB_ORIGIN || "http://localhost:3000",
    process.env.ADMIN_ORIGIN || "http://localhost:3001",
  ];
  server.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (
      req.path.startsWith("/admin") &&
      req.headers.origin &&
      req.headers.origin !== origins[1]
    )
      return res
        .status(403)
        .json({ message: "Untrusted administrator origin" });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !(req.path.startsWith("/admin") ? [origins[1]] : origins).includes(
        req.headers.origin || "",
      )
    )
      return res.status(403).json({ message: "Untrusted request origin" });
    next();
  });
  server.get(
    "/api/health",
    wrap(async (_req, res) => {
      await rows("SELECT 1");
      res.json({ status: "ok", service: "Haskins API", database: "connected" });
    }),
  );
  server.post(
    ["/api/auth/login", "/api/admin/auth/login"],
    wrap(async (req, res) => {
      const ip = req.ip || "unknown",
        now = Date.now();
      if (attempts.size > 10000)
        for (const [key, value] of attempts)
          if (value.until < now) attempts.delete(key);
      // two independent limits: per visitor IP (spray) and per account (targeted guessing)
      const email = text(req.body.email, 190).toLowerCase();
      const keys: [string, number][] = [
        [ip, 20],
        ["acct:" + email, 8],
      ];
      for (const [key, max] of keys) {
        const a = attempts.get(key);
        if (a && a.until > now && a.count >= max)
          throw fail("Too many attempts. Try again in 15 minutes.", 429);
      }
      for (const [key] of keys) {
        const a = attempts.get(key);
        attempts.set(key, {
          count: a && a.until > now ? a.count + 1 : 1,
          until: a && a.until > now ? a.until : now + 900000,
        });
      }
      const [admin] = await rows("SELECT * FROM users WHERE email=?", [email]);
      const [salt, stored] = (
        admin?.password_hash ||
        "00000000000000000000000000000000:" + "00".repeat(64)
      ).split(":");
      const actual = scryptSync(secret(req.body.password), salt, 64);
      if (
        !admin ||
        !admin.active ||
        !timingSafeEqual(Buffer.from(stored, "hex"), actual)
      )
        throw fail("Invalid email or password", 401);
      const adminArea = sessionCookieName(req) === "hic_admin_session";
      if (adminArea && admin.role !== "admin")
        throw fail("This workspace is for administrators.", 403);
      // accounts with two-step sign-in can only sign in through the admin panel's code step
      if (!adminArea && admin.mfa_enabled)
        throw fail("This account uses two-step sign-in. Please sign in through the admin panel.", 403);
      attempts.delete(ip);
      attempts.delete("acct:" + email);
      if (adminArea) {
        const challenge = await startChallenge(admin.id);
        if (challenge) return res.json({ mfaRequired: true, challenge });
      }
      await createSession(res, admin, sessionCookieName(req));
      res.json({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      });
    }),
  );
  server.post(
    ["/api/auth/logout", "/api/admin/auth/logout"],
    wrap(async (req, res) => {
      await rows("DELETE FROM sessions WHERE token_hash=?", [
        hash(cookie(req)),
      ]);
      const name = sessionCookieName(req);
      // Clear a legacy admin session only when it was the cookie used above.
      if (name === "hic_admin_session" && !req.headers.cookie?.split(";").some((v: string) => v.trim().startsWith(name + "=")))
        res.clearCookie("hic_session", sessionCookie());
      res.clearCookie(name, sessionCookie());
      res.json({ ok: true });
    }),
  );
  registerPasswordReset(server); // public: forgot-password and reset/invitation links
  registerMfaLogin(server, (res, user) => createSession(res, user, "hic_admin_session")); // public: the code step
  server.use(
    "/api/admin",
    (req: Request, _res: Response, next: NextFunction) => {
      authenticate(req)
        .then(async () => {
          requireRole(req, "admin");
          // ADMIN_MFA_REQUIRED=true: until two-step sign-in is on, only the set-up screens work
          if (
            mfaRequired() &&
            !MFA_SETUP_PATHS.includes(req.originalUrl.split("?")[0]) &&
            !(await mfaEnabled((req as any).account.id))
          )
            throw fail("Set up two-step sign-in to continue.", 403);
          next();
        })
        .catch(next);
    },
  );
  registerAccounts(server);
  registerTenantServices(server);
  registerMfaAccount(server);
  server.get(
    "/api/admin/inquiries",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT i.*,p.published_title AS property_name FROM inquiries i LEFT JOIN cms_records p ON p.id=i.property_id ORDER BY i.id DESC LIMIT 500",
        ),
      ),
    ),
  );
  server.patch(
    "/api/admin/inquiries/:id",
    wrap(async (req, res) => {
      if (!["new", "in-progress", "resolved"].includes(req.body.status))
        throw fail("Invalid inquiry status");
      await rows("UPDATE inquiries SET status=? WHERE id=?", [
        req.body.status,
        req.params.id,
      ]);
      await audit(req, "update-inquiry");
      res.json({ ok: true });
    }),
  );
  server.post(
    "/api/admin/password",
    wrap(async (req, res) => {
      const [admin] = await rows("SELECT password_hash FROM users WHERE id=?", [
        req.account.id,
      ]);
      const [salt, stored] = admin.password_hash.split(":");
      if (
        !timingSafeEqual(
          scryptSync(secret(req.body.currentPassword), salt, 64),
          Buffer.from(stored, "hex"),
        )
      )
        throw fail("Current password is incorrect");
      const password = secret(req.body.newPassword);
      if (password.length < 12) throw fail("Use at least 12 characters");
      const nextSalt = randomBytes(16).toString("hex");
      await rows("UPDATE users SET password_hash=? WHERE id=?", [
        nextSalt + ":" + scryptSync(password, nextSalt, 64).toString("hex"),
        req.account.id,
      ]);
      await rows("DELETE FROM sessions WHERE user_id=? AND token_hash<>?", [
        req.account.id,
        hash(cookie(req)),
      ]);
      await audit(req, "change-password");
      res.json({ ok: true });
    }),
  );
  server.get(
    "/api/admin/me",
    wrap(async (req, res) =>
      res.json({ ...req.account, mfaEnabled: await mfaEnabled(req.account.id), mfaRequired: mfaRequired() }),
    ),
  );
  server.get(
    "/api/admin/records",
    wrap(async (_req, res) =>
      res.json(await rows("SELECT * FROM cms_records ORDER BY kind,id")),
    ),
  );
  server.get(
    "/api/admin/audit",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT l.*,a.email FROM audit_log l JOIN users a ON a.id=l.actor_id ORDER BY l.id DESC LIMIT 100",
        ),
      ),
    ),
  );
  server.post(
    "/api/admin/records",
    wrap(async (req, res) => {
      const kind = text(req.body.kind),
        slug = text(req.body.slug, 190),
        title = text(req.body.title, 255),
        data = payload(req.body.payload);
      if (
        !kinds.includes(kind) ||
        !title ||
        !slug ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      )
        throw fail("Title and a lowercase URL slug are required");
      const entityId = Number(req.body.entity_id) || null,
        propertyId = Number(req.body.property_id) || null;
      if (kind === "property" && !entityId)
        throw fail("Property owner is required");
      if (["space", "payment"].includes(kind) && !propertyId)
        throw fail("Select a property");
      if (entityId) {
        const [e] = await rows(
          "SELECT id FROM cms_records WHERE id=? AND kind='entity'",
          [entityId],
        );
        if (!e) throw fail("Invalid owning entity");
      }
      if (propertyId) {
        const [p] = await rows(
          "SELECT id FROM cms_records WHERE id=? AND kind='property'",
          [propertyId],
        );
        if (!p) throw fail("Invalid property");
      }
      const id = Number(req.body.id) || null;
      if (id) {
        const [existing] = await rows(
          "SELECT kind FROM cms_records WHERE id=?",
          [id],
        );
        if (!existing || existing.kind !== kind)
          throw fail("Record not found", 404);
        await rows(
          "UPDATE cms_records SET slug=?,title=?,entity_id=?,property_id=?,payload=? WHERE id=?",
          [slug, title, entityId, propertyId, JSON.stringify(data), id],
        );
        await audit(req, "save-draft", id);
        res.json({ id });
      } else {
        const result: any = await rows(
          "INSERT INTO cms_records(kind,slug,title,entity_id,property_id,payload) VALUES (?,?,?,?,?,?)",
          [kind, slug, title, entityId, propertyId, JSON.stringify(data)],
        );
        await audit(req, "create", result.insertId);
        res.json({ id: result.insertId });
      }
    }),
  );
  server.post(
    "/api/admin/records/:id/publish",
    wrap(async (req, res) => {
      const [record] = await rows("SELECT * FROM cms_records WHERE id=?", [
        req.params.id,
      ]);
      if (!record) throw fail("Not found", 404);
      if (record.kind === "payment" && req.body.confirmPayee !== true)
        throw fail("Confirm the property and legal payee before publishing");
      if (
        record.kind === "payment" &&
        (!record.payload.payee || !record.payload.instructions)
      )
        throw fail("Payee and instructions are required");
      if (record.kind === "property") {
        const [e] = await rows(
          "SELECT id FROM cms_records WHERE id=? AND kind='entity' AND published_payload IS NOT NULL",
          [record.entity_id],
        );
        if (!e) throw fail("Publish the owning entity first");
      }
      if (["space", "payment"].includes(record.kind)) {
        const [p] = await rows(
          "SELECT id FROM cms_records WHERE id=? AND kind='property' AND published_payload IS NOT NULL",
          [record.property_id],
        );
        if (!p) throw fail("Publish the related property first");
      }
      await rows(
        "UPDATE cms_records SET published_payload=payload,published_slug=slug,published_title=title,published_entity_id=entity_id,published_property_id=property_id WHERE id=?",
        [record.id],
      );
      await audit(req, "publish", record.id);
      res.json({ ok: true });
    }),
  );
  server.post(
    "/api/admin/records/:id/unpublish",
    wrap(async (req, res) => {
      const [r] = await rows("SELECT * FROM cms_records WHERE id=?", [
        req.params.id,
      ]);
      if (!r) throw fail("Not found", 404);
      const [dependent] = await rows(
        "SELECT id FROM cms_records WHERE (published_entity_id=? OR published_property_id=?) AND published_payload IS NOT NULL LIMIT 1",
        [r.id, r.id],
      );
      if (dependent)
        throw fail(
          "Unpublish dependent properties/spaces/payment instructions first",
        );
      await rows(
        "UPDATE cms_records SET published_payload=NULL,published_slug=NULL,published_title=NULL,published_entity_id=NULL,published_property_id=NULL WHERE id=?",
        [r.id],
      );
      await audit(req, "unpublish", r.id);
      res.json({ ok: true });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  server.get(
    "/api/admin/media",
    wrap(async (_req, res) =>
      res.json(await rows("SELECT * FROM media ORDER BY id DESC")),
    ),
  );
  server.post(
    "/api/admin/media",
    upload.single("file"),
    wrap(async (req, res) => {
      const f = req.file;
      if (!f) throw fail("Choose an image or PDF (maximum 10 MB)");
      const b: Buffer = f.buffer;
      let ext = "";
      let mime = "";
      if (b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
        ext = "jpg";
        mime = "image/jpeg";
      } else if (
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ) {
        ext = "png";
        mime = "image/png";
      } else if (
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      ) {
        ext = "webp";
        mime = "image/webp";
      } else if (b.toString("ascii", 0, 5) === "%PDF-") {
        ext = "pdf";
        mime = "application/pdf";
      } else throw fail("Supported uploads: JPG, PNG, WebP and PDF");
      const filename = randomBytes(20).toString("hex") + "." + ext;
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path.join(uploadDir, filename), b, { flag: "wx" });
      try {
        await rows(
          "INSERT INTO media(filename,original_name,mime,alt) VALUES (?,?,?,?)",
          [
            filename,
            path.basename(f.originalname).slice(0, 255),
            mime,
            text(req.body.alt, 500),
          ],
        );
      } catch (e) {
        await unlink(path.join(uploadDir, filename));
        throw e;
      }
      await audit(req, "upload-media");
      res.json({ url: "/api/media/" + filename });
    }),
  );
  server.patch(
    "/api/admin/media/:id",
    wrap(async (req, res) => {
      await rows("UPDATE media SET alt=? WHERE id=?", [
        text(req.body.alt, 500),
        req.params.id,
      ]);
      await audit(req, "update-media");
      res.json({ ok: true });
    }),
  );
  server.get(
    "/api/media/:filename",
    wrap(async (req, res) => {
      if (!/^[a-f0-9]{40}\.(jpg|png|webp|pdf)$/.test(req.params.filename))
        throw fail("Not found", 404);
      const [m] = await rows("SELECT * FROM media WHERE filename=?", [
        req.params.filename,
      ]);
      if (!m) throw fail("Not found", 404);
      res.type(m.mime);
      if (m.mime === "application/pdf")
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="document.pdf"',
        );
      res.send(await readFile(path.join(uploadDir, m.filename)));
    }),
  );
  server.post(
    "/api/public/inquiries",
    wrap(async (req, res) => {
      if (req.body.website) return res.json({ ok: true });
      const key = "inquiry:" + req.ip,
        now = Date.now(),
        attempt = attempts.get(key);
      if (attempt && attempt.until > now && attempt.count >= 5)
        throw fail("Please wait before submitting another inquiry", 429);
      const name = text(req.body.name, 120),
        email = text(req.body.email, 190),
        message = text(req.body.message, 5000),
        category = text(req.body.category, 80);
      if (
        !name ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        message.length < 10 ||
        ![
          "General inquiry",
          "Space inquiry",
          "Tenant support",
          "Property services",
        ].includes(category)
      )
        throw fail(
          "Enter your name, a valid email and a message of at least 10 characters",
        );
      let propertyId = null;
      if (req.body.property) {
        const [p] = await rows(
          "SELECT id FROM cms_records WHERE kind='property' AND published_slug=? AND published_payload IS NOT NULL",
          [text(req.body.property, 190)],
        );
        if (!p) throw fail("Select a valid property");
        propertyId = p.id;
      }
      attempts.set(key, {
        count: attempt && attempt.until > now ? attempt.count + 1 : 1,
        until: attempt && attempt.until > now ? attempt.until : now + 900000,
      });
      await rows(
        "INSERT INTO inquiries(name,email,category,property_id,message) VALUES (?,?,?,?,?)",
        [name, email, category, propertyId, message],
      );
      // email management in the background; the visitor never waits on (or sees) mail errors
      void notifyInquiry({ name, email, category, message, propertyId });
      res.json({ ok: true });
    }),
  );
  server.get(
    "/api/public/content",
    wrap(async (_req, res) => {
      const records = await rows(
        "SELECT r.id,r.kind,r.updated_at,r.published_slug AS slug,r.published_title AS title,r.published_payload AS payload,e.published_title AS owner,p.published_title AS property_name,p.published_slug AS property_slug,pe.published_title AS property_owner FROM cms_records r LEFT JOIN cms_records e ON e.id=r.published_entity_id LEFT JOIN cms_records p ON p.id=r.published_property_id LEFT JOIN cms_records pe ON pe.id=p.published_entity_id WHERE r.published_payload IS NOT NULL AND r.kind IN ('entity','property','page','space','settings') ORDER BY r.id",
      );
      res.json(records);
    }),
  );
  server.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err.code === "ER_DUP_ENTRY"
        ? 409
        : err.status || (err instanceof multer.MulterError ? 400 : 500);
    if (status === 500) console.error("API error", err.code || err.name);
    res.status(status).json({
      message:
        status === 500
          ? "Server error. Please try again."
          : status === 409
            ? "This URL slug is already in use."
            : err.type === "entity.parse.failed"
              ? "Invalid request body."
              : err.message,
    });
  });
}
