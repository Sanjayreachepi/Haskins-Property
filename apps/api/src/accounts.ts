import { Express, Request, Response, NextFunction } from "express";
import { timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { issueLink } from "./password-reset";
import { db, rows } from "./db";
import {
  roles,
  authenticate,
  requireRole,
  wrap,
  fail,
  text,
  secret,
  passwordHash,
  audit,
  hash,
  cookie,
} from "./security";
export function registerAccounts(server: Express) {
  server.get(
    "/api/auth/me",
    wrap(async (req, res) => {
      await authenticate(req);
      res.json(req.account);
    }),
  );
  for (const prefix of ["/api/account", "/api/tenant"])
    server.use(prefix, (req: Request, _res: Response, next: NextFunction) => {
      authenticate(req)
        .then(() => {
          if (prefix === "/api/tenant") requireRole(req, "tenant");
          next();
        })
        .catch(next);
    });
  server.get(
    "/api/account/me",
    wrap(async (req, res) => res.json(req.account)),
  );
  server.patch(
    "/api/account/profile",
    wrap(async (req, res) => {
      const name = text(req.body.name, 120);
      if (!name) throw fail("Name is required");
      await rows("UPDATE users SET name=? WHERE id=?", [name, req.account.id]);
      await audit(req, "update-profile");
      res.json({ ...req.account, name });
    }),
  );
  server.post(
    "/api/account/password",
    wrap(async (req, res) => {
      const [u] = await rows("SELECT password_hash FROM users WHERE id=?", [
        req.account.id,
      ]);
      const [salt, stored] = u.password_hash.split(":");
      if (
        !timingSafeEqual(
          scryptSync(secret(req.body.currentPassword), salt, 64),
          Buffer.from(stored, "hex"),
        )
      )
        throw fail("Current password is incorrect");
      const next = secret(req.body.newPassword);
      if (next.length < 12) throw fail("Use at least 12 characters");
      await rows("UPDATE users SET password_hash=? WHERE id=?", [
        passwordHash(next),
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
    "/api/admin/users",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT id,name,email,role,active,mfa_enabled,created_at FROM users ORDER BY id",
        ),
      ),
    ),
  );
  server.post(
    "/api/admin/users",
    wrap(async (req, res) => {
      const email = text(req.body.email, 190).toLowerCase(),
        name = text(req.body.name, 120),
        role = req.body.role,
        password = secret(req.body.password);
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !name ||
        !roles.includes(role)
      )
        throw fail("Enter a name, valid email and role");
      // invite = no password yet: the person chooses one from the emailed link
      const invite = req.body.invite === true;
      if (!invite && password.length < 12)
        throw fail("Use a password of at least 12 characters");
      const [exists] = await rows("SELECT id FROM users WHERE email=?", [email]);
      if (exists) throw fail("An account with this email already exists");
      const result: any = await rows(
        "INSERT INTO users(email,name,role,password_hash) VALUES (?,?,?,?)",
        [email, name, role, passwordHash(invite ? randomBytes(32).toString("hex") : password)],
      );
      await audit(req, "create-account", result.insertId);
      if (!invite) return res.json({ id: result.insertId });
      const sent = await issueLink({ id: result.insertId, email, name, role }, "invite");
      await audit(req, "send-invitation", result.insertId);
      res.json({ id: result.insertId, emailed: sent.emailed, ...(sent.emailed ? {} : { link: sent.link }) });
    }),
  );
  // (re)send an invitation or a password-reset link to an existing account
  server.post(
    "/api/admin/users/:id/link",
    wrap(async (req, res) => {
      const purpose = req.body.purpose === "invite" ? "invite" : "reset";
      const [u] = await rows(
        "SELECT id,email,name,role FROM users WHERE id=? AND active=1",
        [Number(req.params.id)],
      );
      if (!u) throw fail("Choose an active account", 404);
      const sent = await issueLink(u, purpose);
      await audit(req, purpose === "invite" ? "send-invitation" : "send-password-reset", u.id);
      res.json({ emailed: sent.emailed, ...(sent.emailed ? {} : { link: sent.link }) });
    }),
  );
  server.patch(
    "/api/admin/users/:id",
    wrap(async (req, res) => {
      const id = Number(req.params.id),
        role = req.body.role,
        name = text(req.body.name, 120),
        active = req.body.active;
      if (!id || !name || !roles.includes(role) || typeof active !== "boolean")
        throw fail("Enter a name, valid role and account status");
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [admins]: any = await connection.query(
          "SELECT id FROM users WHERE role='admin' AND active=1 FOR UPDATE",
        );
        const [current]: any = await connection.execute(
          "SELECT id,role,active FROM users WHERE id=? FOR UPDATE",
          [id],
        );
        const u = current[0];
        if (!u) throw fail("Account not found", 404);
        if (
          u.role === "admin" &&
          u.active &&
          (role !== "admin" || !active) &&
          admins.length <= 1
        )
          throw fail("At least one active administrator must remain");
        if (id === req.account.id && (role !== "admin" || !active))
          throw fail("You cannot remove your own administrator access");
        const password = secret(req.body.password);
        if (password && password.length < 12)
          throw fail("Use a password of at least 12 characters");
        await connection.execute(
          "UPDATE users SET name=?,role=?,active=? WHERE id=?",
          [name, role, active, id],
        );
        if (password)
          await connection.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            [passwordHash(password), id],
          );
        if (u.role !== role || Boolean(u.active) !== active || password)
          await connection.execute("DELETE FROM sessions WHERE user_id=?", [
            id,
          ]);
        await connection.execute(
          "INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)",
          [req.account.id, "update-account", id],
        );
        await connection.commit();
        res.json({ ok: true });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }),
  );
  server.get(
    "/api/admin/tenancies",
    wrap(async (_req, res) =>
      res.json(
        await rows(
          "SELECT t.*,u.name,u.email,p.title AS property_name,e.title AS owner,pay.title AS payment_name FROM tenancies t JOIN users u ON u.id=t.user_id JOIN cms_records p ON p.id=t.property_id LEFT JOIN cms_records e ON e.id=p.entity_id LEFT JOIN cms_records pay ON pay.id=t.payment_record_id ORDER BY t.id DESC",
        ),
      ),
    ),
  );
  server.post(
    "/api/admin/tenancies",
    wrap(async (req, res) => {
      const userId = Number(req.body.user_id),
        propertyId = Number(req.body.property_id),
        paymentId = Number(req.body.payment_record_id) || null,
        reference = text(req.body.reference, 120);
      if (!reference) throw fail("A tenancy reference or unit is required");
      const [user] = await rows(
        "SELECT id FROM users WHERE id=? AND role='tenant' AND active=1",
        [userId],
      );
      if (!user) throw fail("Choose an active tenant account");
      const [property] = await rows(
        "SELECT id FROM cms_records WHERE id=? AND kind='property' AND published_payload IS NOT NULL",
        [propertyId],
      );
      if (!property) throw fail("Choose a published property");
      if (paymentId) {
        const [payment] = await rows(
          "SELECT id FROM cms_records WHERE id=? AND kind='payment' AND published_property_id=? AND published_payload IS NOT NULL",
          [paymentId, propertyId],
        );
        if (!payment)
          throw fail(
            "Choose published payment instructions belonging to this property",
          );
      }
      const result: any = await rows(
        "INSERT INTO tenancies(user_id,property_id,payment_record_id,reference) VALUES (?,?,?,?)",
        [userId, propertyId, paymentId, reference],
      );
      await audit(req, "assign-tenancy", result.insertId);
      res.json({ id: result.insertId });
    }),
  );
  server.patch(
    "/api/admin/tenancies/:id",
    wrap(async (req, res) => {
      if (typeof req.body.active !== "boolean")
        throw fail("Choose an active status");
      const [t] = await rows("SELECT id FROM tenancies WHERE id=?", [
        req.params.id,
      ]);
      if (!t) throw fail("Tenancy not found", 404);
      await rows("UPDATE tenancies SET active=? WHERE id=?", [
        req.body.active,
        req.params.id,
      ]);
      await audit(req, "update-tenancy", t.id);
      res.json({ ok: true });
    }),
  );
  const tenantSelect =
    "SELECT t.id,t.reference,p.published_title AS property_name,p.published_slug AS property_slug,e.published_title AS owner,p.published_payload AS property,pay.published_payload AS payment FROM tenancies t JOIN cms_records p ON p.id=t.property_id JOIN cms_records e ON e.id=p.published_entity_id LEFT JOIN cms_records pay ON pay.id=t.payment_record_id AND pay.kind='payment' AND pay.published_property_id=t.property_id AND pay.published_payload IS NOT NULL WHERE t.user_id=? AND t.active=1 AND p.published_payload IS NOT NULL AND e.published_payload IS NOT NULL";
  server.get(
    "/api/tenant/tenancies",
    wrap(async (req, res) =>
      res.json(await rows(tenantSelect, [req.account.id])),
    ),
  );
  server.get(
    "/api/tenant/tenancies/:id",
    wrap(async (req, res) => {
      const [t] = await rows(tenantSelect + " AND t.id=?", [
        req.account.id,
        req.params.id,
      ]);
      if (!t) throw fail("Tenancy not found", 404);
      res.json(t);
    }),
  );
}
