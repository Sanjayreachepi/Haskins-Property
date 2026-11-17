import { Express, Response } from "express";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import QRCode from "qrcode";
import { rows } from "./db";
import { cookie, fail, hash, passwordMatches, secret, text, wrap } from "./security";

/**
 * Two-step sign-in (TOTP, RFC 6238) for administrator accounts.
 *
 * - Works with any authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
 * - The secret is encrypted at rest (AES-256-GCM) with MFA_ENCRYPTION_KEY.
 * - Each code can be used once (the last accepted time step is stored); ±30 s clock drift is allowed.
 * - 10 single-use recovery codes are shown once when MFA is switched on; only hashes are stored.
 * - Sign-in: password → short-lived challenge (5 min, 5 tries) → code → session.
 * - ADMIN_MFA_REQUIRED=true: administrators without MFA can only reach the set-up screens.
 */

/* ---------------- base32 + TOTP ---------------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secretB32: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
const currentStep = () => Math.floor(Date.now() / 30_000);
/** Returns the matching time step (to block reuse), or null. */
function matchStep(secretB32: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep();
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totp(secretB32, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/* ---------------- secret encryption ---------------- */
function key(): Buffer {
  const k = process.env.MFA_ENCRYPTION_KEY || "";
  if (k) return createHash("sha256").update(k).digest();
  if (process.env.NODE_ENV === "production")
    throw fail("Two-step sign-in is not configured on the server (MFA_ENCRYPTION_KEY).", 500);
  return createHash("sha256").update("haskins-dev-only-mfa-key").digest();
}
function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}
function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(":");
  if (v !== "v1") throw fail("Unreadable two-step secret", 500);
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

/* ---------------- recovery codes ---------------- */
const normalizeRecovery = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
async function newRecoveryCodes(userId: number): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () => {
    const s = randomBytes(5).toString("hex"); // 10 hex chars
    return s.slice(0, 5) + "-" + s.slice(5);
  });
  await rows("DELETE FROM mfa_recovery_codes WHERE user_id=?", [userId]);
  for (const c of codes)
    await rows("INSERT INTO mfa_recovery_codes(user_id,code_hash) VALUES (?,?)", [userId, hash(normalizeRecovery(c))]);
  return codes;
}

/** Checks a 6-digit code or a recovery code for an account with MFA on; marks it used. */
async function verifySecondFactor(userId: number, input: string): Promise<boolean> {
  const code = text(input, 40).replace(/\s/g, "");
  const [u] = await rows("SELECT mfa_secret,mfa_last_step FROM users WHERE id=? AND mfa_enabled=1", [userId]);
  if (!u?.mfa_secret) return false;
  if (/^\d{6}$/.test(code)) {
    const step = matchStep(open(u.mfa_secret), code, u.mfa_last_step === null ? null : Number(u.mfa_last_step));
    if (step === null) return false;
    // conditional update: two simultaneous requests cannot both use the same code
    const r: any = await rows(
      "UPDATE users SET mfa_last_step=? WHERE id=? AND (mfa_last_step IS NULL OR mfa_last_step<?)",
      [step, userId, step],
    );
    return r.affectedRows === 1;
  }
  const r: any = await rows("DELETE FROM mfa_recovery_codes WHERE user_id=? AND code_hash=?", [userId, hash(normalizeRecovery(code))]);
  if (r.affectedRows === 1) {
    await rows("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [userId, "mfa-recovery-code-used", userId]);
    return true;
  }
  return false;
}

export const mfaRequired = () => process.env.ADMIN_MFA_REQUIRED === "true";

/** Called by the admin login after the password is correct. Returns a challenge when a code is needed. */
export async function startChallenge(userId: number): Promise<string | null> {
  const [u] = await rows("SELECT mfa_enabled FROM users WHERE id=?", [userId]);
  if (!u?.mfa_enabled) return null;
  await rows("DELETE FROM mfa_challenges WHERE expires_at<UTC_TIMESTAMP() OR user_id=?", [userId]);
  const token = randomBytes(32).toString("hex");
  await rows(
    "INSERT INTO mfa_challenges(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))",
    [hash(token), userId],
  );
  return token;
}

/**
 * Routes. `createSession` is the login's own session writer (so cookies stay identical).
 * Must be registered before the /api/admin auth middleware (the code step is public).
 */
export function registerMfaLogin(
  server: Express,
  createSession: (res: Response, user: any) => Promise<void>,
) {
  server.post(
    "/api/admin/auth/mfa",
    wrap(async (req, res) => {
      const token = text(req.body.challenge, 100);
      if (!/^[a-f0-9]{64}$/.test(token)) throw fail("Please sign in again.", 401);
      const [c] = await rows(
        "SELECT c.user_id,c.attempts,u.* FROM mfa_challenges c JOIN users u ON u.id=c.user_id WHERE c.token_hash=? AND c.expires_at>UTC_TIMESTAMP() AND u.active=1",
        [hash(token)],
      );
      if (!c) throw fail("Your sign-in expired. Please enter your password again.", 401);
      if (c.attempts >= 5) {
        await rows("DELETE FROM mfa_challenges WHERE token_hash=?", [hash(token)]);
        throw fail("Too many wrong codes. Please sign in again.", 429);
      }
      await rows("UPDATE mfa_challenges SET attempts=attempts+1 WHERE token_hash=?", [hash(token)]);
      if (!(await verifySecondFactor(c.user_id, req.body.code)))
        throw fail("That code is not correct. Check your authenticator app and try again.", 401);
      await rows("DELETE FROM mfa_challenges WHERE user_id=?", [c.user_id]);
      await createSession(res, c);
      res.json({ id: c.user_id, email: c.email, name: c.name, role: c.role });
    }),
  );
}

/** Routes for the signed-in administrator (registered after the /api/admin auth middleware). */
export function registerMfaAccount(server: Express) {
  server.get(
    "/api/admin/mfa",
    wrap(async (req, res) => {
      const [u] = await rows("SELECT mfa_enabled FROM users WHERE id=?", [req.account.id]);
      const [{ n }] = await rows("SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id=?", [req.account.id]);
      res.json({ enabled: !!u.mfa_enabled, required: mfaRequired(), recoveryCodesLeft: Number(n) });
    }),
  );
  // step 1: new secret (not active until a code is confirmed)
  server.post(
    "/api/admin/mfa/setup",
    wrap(async (req, res) => {
      const [u] = await rows("SELECT email,mfa_enabled FROM users WHERE id=?", [req.account.id]);
      if (u.mfa_enabled) throw fail("Two-step sign-in is already on. Turn it off first to change your device.");
      const s = base32Encode(randomBytes(20));
      await rows("UPDATE users SET mfa_secret=?, mfa_last_step=NULL WHERE id=?", [seal(s), req.account.id]);
      const issuer = "Haskins Admin";
      const uri = `otpauth://totp/${encodeURIComponent(issuer + ":" + u.email)}?secret=${s}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
      res.json({ secret: s.replace(/(.{4})/g, "$1 ").trim(), uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
    }),
  );
  // step 2: confirm with a code from the app → on, with recovery codes
  server.post(
    "/api/admin/mfa/enable",
    wrap(async (req, res) => {
      const [u] = await rows("SELECT mfa_secret,mfa_enabled FROM users WHERE id=?", [req.account.id]);
      if (u.mfa_enabled) throw fail("Two-step sign-in is already on.");
      if (!u.mfa_secret) throw fail("Start the set-up first.");
      const step = matchStep(open(u.mfa_secret), text(req.body.code, 10).replace(/\s/g, ""), null);
      if (step === null) throw fail("That code is not correct. Make sure your phone's clock is set automatically and try the newest code.");
      await rows("UPDATE users SET mfa_enabled=1, mfa_last_step=? WHERE id=?", [step, req.account.id]);
      const codes = await newRecoveryCodes(req.account.id);
      // sign out every other session of this account
      await rows("DELETE FROM sessions WHERE user_id=? AND token_hash<>?", [req.account.id, hash(cookie(req))]);
      await rows("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [req.account.id, "mfa-enabled", req.account.id]);
      res.json({ enabled: true, recoveryCodes: codes });
    }),
  );
  server.post(
    "/api/admin/mfa/recovery-codes",
    wrap(async (req, res) => {
      await requirePasswordAndCode(req.account.id, req.body);
      const codes = await newRecoveryCodes(req.account.id);
      await rows("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [req.account.id, "mfa-recovery-codes-renewed", req.account.id]);
      res.json({ recoveryCodes: codes });
    }),
  );
  server.post(
    "/api/admin/mfa/disable",
    wrap(async (req, res) => {
      if (mfaRequired()) throw fail("Two-step sign-in is required for administrators on this site.");
      await requirePasswordAndCode(req.account.id, req.body);
      await turnOff(req.account.id);
      await rows("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [req.account.id, "mfa-disabled", req.account.id]);
      res.json({ enabled: false });
    }),
  );
  // another administrator resets a colleague who lost their phone and recovery codes
  server.post(
    "/api/admin/users/:id/mfa-reset",
    wrap(async (req, res) => {
      const id = Number(req.params.id);
      if (id === req.account.id) throw fail("Use My account to change your own two-step sign-in.");
      const [u] = await rows("SELECT id FROM users WHERE id=?", [id]);
      if (!u) throw fail("Account not found", 404);
      await turnOff(id);
      await rows("DELETE FROM sessions WHERE user_id=?", [id]);
      await rows("INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)", [req.account.id, "mfa-reset", id]);
      res.json({ ok: true });
    }),
  );
}

async function turnOff(userId: number) {
  await rows("UPDATE users SET mfa_enabled=0, mfa_secret=NULL, mfa_last_step=NULL WHERE id=?", [userId]);
  await rows("DELETE FROM mfa_recovery_codes WHERE user_id=?", [userId]);
  await rows("DELETE FROM mfa_challenges WHERE user_id=?", [userId]);
}

async function requirePasswordAndCode(userId: number, body: any) {
  const [u] = await rows("SELECT password_hash FROM users WHERE id=?", [userId]);
  if (!passwordMatches(secret(body.password), u.password_hash)) throw fail("Your password is not correct.");
  if (!(await verifySecondFactor(userId, body.code))) throw fail("That code is not correct.");
}

/** Paths an administrator may use before setting up MFA when ADMIN_MFA_REQUIRED=true. */
export const MFA_SETUP_PATHS = ["/api/admin/me", "/api/admin/mfa", "/api/admin/mfa/setup", "/api/admin/mfa/enable", "/api/admin/auth/logout", "/api/admin/password"];
export async function mfaEnabled(userId: number): Promise<boolean> {
  const [u] = await rows("SELECT mfa_enabled FROM users WHERE id=?", [userId]);
  return !!u?.mfa_enabled;
}
