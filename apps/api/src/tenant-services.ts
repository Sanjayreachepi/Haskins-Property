import type { Express } from "express";
import multer from "multer";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { rows } from "./db";
import { audit, fail, text, wrap } from "./security";
import { limitAccountAction } from "./account-security";

const tenancyJoin =
  " FROM tenancies t JOIN users u ON u.id=t.user_id JOIN cms_records p ON p.id=t.property_id JOIN cms_records e ON e.id=p.published_entity_id ";
const activeTenancy =
  "t.active=1 AND u.active=1 AND u.role='tenant' AND p.published_payload IS NOT NULL AND e.published_payload IS NOT NULL";
async function tenancy(req: any, id: unknown) {
  const [t] = await rows(
    "SELECT t.id,t.user_id" +
      tenancyJoin +
      "WHERE t.id=? AND " +
      activeTenancy +
      (req.account.role === "admin" ? "" : " AND t.user_id=?"),
    req.account.role === "admin" ? [id] : [id, req.account.id],
  );
  if (!t) throw fail("Tenancy not found or no longer active.", 404);
  return t;
}
function privateDirectory() {
  const root = path.resolve(
    process.env.PRIVATE_DOCUMENT_DIR || "private-tenant-files",
  );
  const publicRoots = [
    path.resolve(process.env.UPLOAD_DIR || "uploads"),
    path.resolve("../web/public"),
    path.resolve("../admin/public"),
    path.resolve("public"),
  ];
  if (publicRoots.some((p) => root === p || root.startsWith(p + path.sep)))
    throw fail(
      "Private document storage must be outside public media directories.",
      503,
    );
  return root;
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 3, fieldSize: 1000 },
});
const metadata = "id,tenancy_id,title,original_name,active,created_at";

export function registerTenantServices(server: Express) {
  // /admin and /tenant authentication middleware is registered before these handlers.
  server.get(
    "/api/admin/tenant-documents",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT " +
            metadata +
            " FROM tenant_documents ORDER BY id DESC LIMIT 1000",
        ),
      ),
    ),
  );
  server.post(
    "/api/admin/tenant-documents",
    upload.single("file"),
    wrap(async (req, res) => {
      limitAccountAction("document-upload:" + req.account.id, 30, 3600000);
      const title = text(req.body.title, 200),
        t = await tenancy(req, req.body.tenancy_id),
        f = req.file;
      if (!title || !f || f.buffer.subarray(0, 5).toString() !== "%PDF-")
        throw fail("Choose a PDF (maximum 10 MB) and enter a title.");
      const root = privateDirectory(),
        filename = randomBytes(32).toString("hex") + ".pdf";
      await mkdir(root, { recursive: true, mode: 0o700 });
      await writeFile(path.join(root, filename), f.buffer, {
        flag: "wx",
        mode: 0o600,
      });
      let result: any;
      try {
        result = await rows(
          "INSERT INTO tenant_documents(tenancy_id,title,filename,original_name,created_by) VALUES (?,?,?,?,?)",
          [
            t.id,
            title,
            filename,
            path
              .basename(f.originalname)
              .replace(/[\r\n]/g, "")
              .slice(0, 255),
            req.account.id,
          ],
        );
      } catch (e) {
        await unlink(path.join(root, filename));
        throw e;
      }
      await audit(req, "share-private-document", result.insertId);
      res.json({ id: result.insertId });
    }),
  );
  server.patch(
    "/api/admin/tenant-documents/:id",
    wrap(async (req, res) => {
      if (typeof req.body.active !== "boolean")
        throw fail("Choose an active status.");
      const result: any = await rows(
        "UPDATE tenant_documents SET active=? WHERE id=?",
        [req.body.active, req.params.id],
      );
      if (!result.affectedRows) throw fail("Document not found.", 404);
      await audit(req, "update-private-document", Number(req.params.id));
      res.json({ ok: true });
    }),
  );
  server.get(
    "/api/tenant/documents",
    wrap(async (req, res) =>
      res.json(
        await rows(
          "SELECT d.id,d.tenancy_id,d.title,d.original_name,d.created_at FROM tenant_documents d JOIN tenancies t ON t.id=d.tenancy_id JOIN cms_records p ON p.id=t.property_id JOIN cms_records e ON e.id=p.published_entity_id WHERE d.active=1 AND t.user_id=? AND t.active=1 AND p.published_payload IS NOT NULL AND e.published_payload IS NOT NULL ORDER BY d.id DESC",
          [req.account.id],
        ),
      ),
    ),
  );
  server.get(
    [
      "/api/tenant/documents/:id/download",
      "/api/admin/tenant-documents/:id/download",
    ],
    wrap(async (req, res) => {
      const [d] = await rows(
        "SELECT * FROM tenant_documents WHERE id=? AND active=1",
        [req.params.id],
      );
      if (!d) throw fail("Document not found.", 404);
      await tenancy(req, d.tenancy_id);
      if (!/^[a-f0-9]{64}\.pdf$/.test(d.filename))
        throw fail("Document not found.", 404);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      await new Promise<void>((resolve, reject) =>
        res.download(
          path.join(privateDirectory(), d.filename),
          d.original_name,
          (err) => {
            if (err) reject(fail("Document unavailable.", 404));
            else resolve();
          },
        ),
      );
    }),
  );
  server.get(
    "/api/admin/tenant-notices",
    wrap(async (_req, res) =>
      res.json(
        await rows("SELECT * FROM tenant_notices ORDER BY id DESC LIMIT 1000"),
      ),
    ),
  );
  server.post(
    "/api/admin/tenant-notices",
    wrap(async (req, res) => {
      const t = await tenancy(req, req.body.tenancy_id),
        title = text(req.body.title, 200),
        content = text(req.body.content, 10000);
      if (!title || !content) throw fail("Enter a notice title and message.");
      const result: any = await rows(
        "INSERT INTO tenant_notices(tenancy_id,title,content,created_by) VALUES (?,?,?,?)",
        [t.id, title, content, req.account.id],
      );
      await audit(req, "share-tenant-notice", result.insertId);
      res.json({ id: result.insertId });
    }),
  );
  server.patch(
    "/api/admin/tenant-notices/:id",
    wrap(async (req, res) => {
      if (typeof req.body.active !== "boolean")
        throw fail("Choose an active status.");
      const result: any = await rows(
        "UPDATE tenant_notices SET active=? WHERE id=?",
        [req.body.active, req.params.id],
      );
      if (!result.affectedRows) throw fail("Notice not found.", 404);
      await audit(req, "update-tenant-notice", Number(req.params.id));
      res.json({ ok: true });
    }),
  );
  server.get(
    "/api/tenant/notices",
    wrap(async (req, res) =>
      res.json(
        await rows(
          "SELECT n.id,n.tenancy_id,n.title,n.content,n.created_at FROM tenant_notices n JOIN tenancies t ON t.id=n.tenancy_id JOIN cms_records p ON p.id=t.property_id JOIN cms_records e ON e.id=p.published_entity_id WHERE n.active=1 AND t.user_id=? AND t.active=1 AND p.published_payload IS NOT NULL AND e.published_payload IS NOT NULL ORDER BY n.id DESC",
          [req.account.id],
        ),
      ),
    ),
  );

  server.get(
    "/api/admin/maintenance-tickets",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT k.*,t.reference,u.name,u.email,p.published_title AS property_name FROM maintenance_tickets k JOIN tenancies t ON t.id=k.tenancy_id JOIN users u ON u.id=t.user_id JOIN cms_records p ON p.id=t.property_id ORDER BY k.id DESC LIMIT 1000",
        ),
      ),
    ),
  );
  server.get(
    "/api/tenant/maintenance-tickets",
    wrap(async (req, res) =>
      res.json(
        await rows(
          "SELECT k.* FROM maintenance_tickets k JOIN tenancies t ON t.id=k.tenancy_id JOIN cms_records p ON p.id=t.property_id JOIN cms_records e ON e.id=p.published_entity_id WHERE t.user_id=? AND t.active=1 AND p.published_payload IS NOT NULL AND e.published_payload IS NOT NULL ORDER BY k.id DESC",
          [req.account.id],
        ),
      ),
    ),
  );
  server.post(
    "/api/tenant/maintenance-tickets",
    wrap(async (req, res) => {
      limitAccountAction("ticket-create:" + req.account.id, 10, 3600000);
      const t = await tenancy(req, req.body.tenancy_id),
        subject = text(req.body.subject, 200),
        description = text(req.body.description, 10000);
      if (!subject || !description)
        throw fail("Enter a subject and description.");
      const result: any = await rows(
        "INSERT INTO maintenance_tickets(tenancy_id,subject,description) VALUES (?,?,?)",
        [t.id, subject, description],
      );
      await audit(req, "create-maintenance-ticket", result.insertId);
      res.json({ id: result.insertId });
    }),
  );
  async function ticket(req: any) {
    const [k] = await rows("SELECT * FROM maintenance_tickets WHERE id=?", [
      req.params.id,
    ]);
    if (!k) throw fail("Request not found.", 404);
    if (req.account.role !== "admin") await tenancy(req, k.tenancy_id);
    return k;
  }
  server.get(
    [
      "/api/tenant/maintenance-tickets/:id",
      "/api/admin/maintenance-tickets/:id",
    ],
    wrap(async (req, res) => {
      const k = await ticket(req);
      const messages = await rows(
        "SELECT m.id,m.message,m.created_at,CASE WHEN u.role='admin' THEN 'Management' ELSE u.name END AS author FROM maintenance_messages m JOIN users u ON u.id=m.author_id WHERE ticket_id=? ORDER BY m.id",
        [k.id],
      );
      res.json({ ...k, messages });
    }),
  );
  server.post(
    [
      "/api/tenant/maintenance-tickets/:id/messages",
      "/api/admin/maintenance-tickets/:id/messages",
    ],
    wrap(async (req, res) => {
      limitAccountAction("ticket-reply:" + req.account.id, 30, 3600000);
      const k = await ticket(req),
        message = text(req.body.message, 10000);
      if (!message) throw fail("Enter a message.");
      await rows(
        "INSERT INTO maintenance_messages(ticket_id,author_id,message) VALUES (?,?,?)",
        [k.id, req.account.id, message],
      );
      await rows(
        "UPDATE maintenance_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [k.id],
      );
      await audit(req, "reply-maintenance-ticket", k.id);
      res.json({ ok: true });
    }),
  );
  server.patch(
    "/api/admin/maintenance-tickets/:id",
    wrap(async (req, res) => {
      const k = await ticket(req),
        status = req.body.status;
      if (!["new", "in-progress", "resolved"].includes(status))
        throw fail("Choose a valid status.");
      await rows("UPDATE maintenance_tickets SET status=? WHERE id=?", [
        status,
        k.id,
      ]);
      await audit(req, "update-maintenance-ticket", k.id);
      res.json({ ok: true });
    }),
  );
}
