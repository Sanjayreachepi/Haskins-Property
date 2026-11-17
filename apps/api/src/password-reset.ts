import { Express } from "express";
import { randomBytes } from "node:crypto";
import { db, rows } from "./db";
import { fail, hash, passwordHash, secret, text, wrap } from "./security";
import { sendLinkEmail } from "./mail";

/**
 * Password reset ("forgot password") and account invitations.
 *
 * - A one-time token is emailed as a link; only its SHA-256 hash is stored.
 * - Reset links last 1 hour, invitation links 72 hours. A new link replaces any older one.
 * - Using a link sets the password, deletes every token for the account and signs it out everywhere.
 * - Admin accounts get a link to the admin panel, everyone else to the website.
 * - "Forgot password" always answers the same way, so it never reveals whether an email has an account.
 */
const WEB = () => process.env.WEB_ORIGIN || "http://localhost:3000";
const ADMIN = () => process.env.ADMIN_ORIGIN || "http://localhost:3001";
const HOURS = { reset: 1, invite: 72 } as const;

type Account = { id: number; email: string; name: string; role: string };

/** Creates a token and emails the link. Returns the link only when it could not be emailed. */
export async function issueLink(
  user: Account,
  purpose: "reset" | "invite",
): Promise<{ emailed: boolean; link: string }> {
  const token = randomBytes(32).toString("hex");
  await rows("DELETE FROM password_tokens WHERE user_id=?", [user.id]);
  await rows(
    "INSERT INTO password_tokens(user_id,token_hash,purpose,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? HOUR))",
    [user.id, hash(token), purpose, HOURS[purpose]],
  );
  const base = user.role === "admin" ? ADMIN() : WEB();
  const link = `${base}/reset-password?token=${token}${purpose === "invite" ? "&invite=1" : ""}${user.role === "user" ? "&account=1" : ""}`;
  const where = user.role === "admin" ? "the Haskins admin panel" : user.role === "tenant" ? "the Haskins tenant portal" : "the Haskins website";
  const emailed = await sendLinkEmail(
    purpose === "invite"
      ? {
          to: user.email,
          name: user.name,
          subject: "You're invited to " + where,
          intro: `An account has been created for you on ${where}. Choose your password to get started.`,
          button: "Set my password",
          link,
          footer: `This link works once and expires in ${HOURS.invite} hours. If you were not expecting this, you can ignore this email.`,
        }
      : {
          to: user.email,
          name: user.name,
          subject: "Reset your password",
          intro: `Someone asked to reset the password for your account on ${where}.`,
          button: "Choose a new password",
          link,
          footer: `This link works once and expires in ${HOURS.reset} hour. If you did not ask for it, ignore this email — your password stays the same.`,
        },
  );
  if (!emailed && process.env.NODE_ENV !== "production")
    console.log(`[mail] ${purpose} link for account ${user.id} (not emailed): ${link}`);
  return { emailed, link };
}

const limits = new Map<string, { count: number; until: number }>();
function limit(key: string, max: number, ms: number) {
  const now = Date.now();
  if (limits.size > 10000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const a = limits.get(key);
  if (a && a.until > now && a.count >= max)
    throw fail("Too many requests. Try again later.", 429);
  limits.set(key, {
    count: a && a.until > now ? a.count + 1 : 1,
    until: a && a.until > now ? a.until : now + ms,
  });
}

/** Must be registered before the /api/admin authentication middleware (these routes are public). */
export function registerPasswordReset(server: Express) {
  server.post(
    ["/api/auth/forgot", "/api/admin/auth/forgot"],
    wrap(async (req, res) => {
      const email = text(req.body.email, 190).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail("Enter a valid email address");
      limit("ip:" + (req.ip || "unknown"), 10, 15 * 60_000);
      limit("mail:" + email, 3, 60 * 60_000);
      const [user] = await rows(
        "SELECT id,email,name,role FROM users WHERE email=? AND active=1",
        [email],
      );
      const adminArea = req.path.startsWith("/api/admin");
      // the admin panel only resets administrator accounts; the site resets every account
      if (user && (!adminArea || user.role === "admin")) await issueLink(user, "reset");
      res.json({
        ok: true,
        message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour.",
      });
    }),
  );

  server.post(
    ["/api/auth/reset", "/api/admin/auth/reset"],
    wrap(async (req, res) => {
      limit("reset:" + (req.ip || "unknown"), 20, 15 * 60_000);
      const token = text(req.body.token, 100);
      const password = secret(req.body.password);
      if (!/^[a-f0-9]{64}$/.test(token)) throw fail("This link is not valid. Ask for a new one.");
      if (password.length < 12) throw fail("Use a password of at least 12 characters");
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [found]: any = await connection.execute(
          "SELECT t.id,t.user_id,t.purpose,u.role FROM password_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>UTC_TIMESTAMP() AND u.active=1 FOR UPDATE",
          [hash(token)],
        );
        const t = found[0];
        if (!t) throw fail("This link has expired or was already used. Ask for a new one.");
        await connection.execute("UPDATE users SET password_hash=? WHERE id=?", [passwordHash(password), t.user_id]);
        await connection.execute("DELETE FROM password_tokens WHERE user_id=?", [t.user_id]);
        await connection.execute("DELETE FROM sessions WHERE user_id=?", [t.user_id]);
        await connection.execute("DELETE FROM mfa_challenges WHERE user_id=?", [t.user_id]);
        await connection.execute("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [t.user_id, t.purpose === "invite" ? "accept-invitation" : "reset-password", t.user_id]);
        await connection.commit();
        res.json({ ok: true, role: t.role });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
  );
}
