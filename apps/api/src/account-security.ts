import { randomBytes } from "node:crypto";
import type { Express } from "express";
import { db, rows } from "./db";
import {
  audit,
  fail,
  hash,
  passwordHash,
  secret,
  text,
  wrap,
  roles,
} from "./security";
import { sendAccountEmail } from "./mail";

const attempts = new Map<string, { count: number; until: number }>();
export function limitAccountAction(
  key: string,
  maximum = 8,
  milliseconds = 900000,
) {
  const now = Date.now();
  if (attempts.size > 10000)
    for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const entry = attempts.get(key);
  if (entry && entry.until > now) {
    if (entry.count >= maximum)
      throw fail("Too many attempts. Please try again later.", 429);
    entry.count++;
  } else attempts.set(key, { count: 1, until: now + milliseconds });
}
async function issueAccountToken(
  user: { id: number; email: string; role: string },
  purpose: "invite" | "reset",
) {
  const token = randomBytes(32).toString("hex");
  const expires = purpose === "invite" ? 24 : 1;
  const origin =
    user.role === "admin"
      ? process.env.ADMIN_ORIGIN || "http://localhost:3001"
      : process.env.WEB_ORIGIN || "http://localhost:3000";
  const url = new URL(user.role === "admin" ? "/" : "/tenant-portal", origin);
  url.hash = "account-token=" + token;
  // Do not email live links until SMTP is configured; never log or return the token.
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id=? FOR UPDATE", [
      user.id,
    ]);
    await connection.execute(
      "DELETE FROM account_tokens WHERE user_id=? AND purpose=?",
      [user.id, purpose],
    );
    await connection.execute(
      "INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? HOUR))",
      [hash(token), user.id, purpose, expires],
    );
    await sendAccountEmail(user.email, purpose, url.toString(), expires);
    await connection.commit();
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export function registerAccountSecurity(server: Express) {
  server.post(
    ["/api/auth/request-reset", "/api/admin/auth/request-reset"],
    wrap(async (req, res) => {
      limitAccountAction("reset-ip:" + req.ip, 12);
      const email = text(req.body.email, 190).toLowerCase();
      limitAccountAction("reset-email:" + hash(email), 3);
      const [user] = await rows(
        "SELECT id,email,role FROM users WHERE email=? AND active=1 AND invitation_pending=0",
        [email],
      );
      if (user) {
        // Respond without waiting on SMTP so account existence is not exposed by mail latency.
        void issueAccountToken(user, "reset").catch(() => {
          console.error("[mail] password reset could not be delivered");
        });
      }
      res.json({
        message:
          "If the account is eligible, a password reset link will be emailed. Contact management if it does not arrive.",
      });
    }),
  );
  server.post(
    ["/api/auth/set-password", "/api/admin/auth/set-password"],
    wrap(async (req, res) => {
      limitAccountAction("set-password:" + req.ip, 15);
      const token = text(req.body.token, 64),
        password = secret(req.body.password);
      if (
        !/^[a-f0-9]{64}$/.test(token) ||
        password.length < 12 ||
        String(req.body.password).length > 256
      )
        throw fail("Use a valid link and a password of 12–256 characters.");
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [found]: any = await connection.execute(
          "SELECT t.*,u.active,u.invitation_pending FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>UTC_TIMESTAMP() FOR UPDATE",
          [hash(token)],
        );
        const record = found[0];
        if (
          !record ||
          (record.purpose === "reset" && !record.active) ||
          (record?.purpose === "invite" && !record.invitation_pending)
        )
          throw fail(
            "This link has expired or has already been used. Request a new link.",
          );
        await connection.execute(
          "UPDATE users SET password_hash=?,active=1,invitation_pending=0 WHERE id=?",
          [passwordHash(password), record.user_id],
        );
        await connection.execute("DELETE FROM account_tokens WHERE user_id=?", [
          record.user_id,
        ]);
        await connection.execute(
          "DELETE FROM admin_login_otps WHERE user_id=?",
          [record.user_id],
        );
        await connection.execute("DELETE FROM sessions WHERE user_id=?", [
          record.user_id,
        ]);
        await connection.execute(
          "INSERT INTO audit_log(actor_id,action) VALUES (?,?)",
          [
            record.user_id,
            record.purpose === "invite" ? "activate-account" : "reset-password",
          ],
        );
        await connection.commit();
        res.json({
          message:
            "Password saved. Please sign in. Existing sessions have been signed out.",
        });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }),
  );
  server.post(
    "/api/admin/invitations",
    wrap(async (req, res) => {
      await admin(req);
      limitAccountAction("invite:" + req.account.id, 20, 3600000);
      if (!process.env.SMTP_HOST)
        throw fail("Configure account email before inviting users.", 503);
      const name = text(req.body.name, 120),
        email = text(req.body.email, 190).toLowerCase(),
        role = req.body.role;
      if (
        !name ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !roles.includes(role)
      )
        throw fail("Enter a name, valid email and role.");
      const result: any = await rows(
        "INSERT INTO users(name,email,role,password_hash,active,invitation_pending) VALUES (?,?,?,?,0,1)",
        [name, email, role, passwordHash(randomBytes(32).toString("hex"))],
      );
      await audit(req, "invite-account", result.insertId);
      try {
        await issueAccountToken({ id: result.insertId, email, role }, "invite");
      } catch {
        throw fail(
          "Account is pending, but email delivery failed. Resend its invitation after checking email configuration.",
          503,
        );
      }
      res.json({
        id: result.insertId,
        message:
          "Invitation emailed. The account remains pending until activation.",
      });
    }),
  );
  server.post(
    "/api/admin/users/:id/invite",
    wrap(async (req, res) => {
      await admin(req);
      limitAccountAction("resend:" + req.params.id, 3);
      const [user] = await rows(
        "SELECT id,email,role FROM users WHERE id=? AND invitation_pending=1",
        [req.params.id],
      );
      if (!user) throw fail("Choose an account awaiting activation.");
      await issueAccountToken(user, "invite");
      await audit(req, "resend-invitation", user.id);
      res.json({
        message:
          "Invitation emailed. Previous invitation links no longer work.",
      });
    }),
  );
}

import { authenticate, requireRole } from "./security";
async function admin(req: any) {
  await authenticate(req);
  requireRole(req, "admin");
}
