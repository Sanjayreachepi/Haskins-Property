import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { db } from "./db";
import {
  fail,
  hash,
  sessionCookie,
  sessionCookieName,
  text,
  wrap,
} from "./security";
import { limitAccountAction } from "./account-security";
import { sendLoginOtp } from "./mail";

/** Only called after the password and active account role have been checked. */
export async function issueLoginOtp(userId: number, email: string) {
  const challenge = randomBytes(32).toString("hex"),
    code = String(randomInt(1000000)).padStart(6, "0");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [users]: any = await connection.execute(
      "SELECT id FROM users WHERE id=? AND role IN ('admin','tenant') AND active=1 AND invitation_pending=0 FOR UPDATE",
      [userId],
    );
    if (!users.length) throw fail("Please sign in again.", 401);
    const [recent]: any = await connection.execute(
      "SELECT user_id FROM admin_login_otps WHERE user_id=? AND created_at>DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 60 SECOND)",
      [userId],
    );
    if (recent.length)
      throw fail("Please wait 60 seconds before requesting another code.", 429);
    limitAccountAction("login-otp-send:" + userId, 5);
    await connection.execute(
      "INSERT INTO admin_login_otps(user_id,challenge_hash,code_hash,attempts,expires_at) VALUES (?,?,?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) ON DUPLICATE KEY UPDATE challenge_hash=VALUES(challenge_hash),code_hash=VALUES(code_hash),attempts=0,expires_at=VALUES(expires_at),created_at=CURRENT_TIMESTAMP",
      [userId, hash(challenge), hash(challenge + ":" + code)],
    );
    const demo =
      process.env.NODE_ENV !== "production" &&
      process.env.DEMO_LOGIN_OTP === "true";
    if (!demo) await sendLoginOtp(email, code);
    await connection.commit();
    return { challenge, ...(demo ? { developmentCode: code } : {}) };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}
export function registerLoginOtp(server: Express) {
  server.post(
    ["/api/admin/auth/verify-otp", "/api/auth/verify-otp"],
    wrap(async (req, res) => {
      limitAccountAction("login-otp-verify:" + req.ip, 30);
      const challenge = text(req.body.challenge, 65),
        code = text(req.body.code, 7);
      if (!/^[a-f0-9]{64}$/.test(challenge) || !/^\d{6}$/.test(code))
        throw fail("Enter the six-digit code from your email.", 400);
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [found]: any = await connection.execute(
          "SELECT o.*,u.email,u.name,u.role,u.active,u.invitation_pending FROM admin_login_otps o JOIN users u ON u.id=o.user_id WHERE o.challenge_hash=? AND o.expires_at>UTC_TIMESTAMP() FOR UPDATE",
          [hash(challenge)],
        );
        const otp = found[0];
        if (
          !otp ||
          !otp.active ||
          otp.invitation_pending ||
          !["admin", "tenant"].includes(otp.role) ||
          otp.attempts >= 5
        ) {
          await connection.rollback();
          throw fail(
            "This sign-in code has expired or is no longer valid. Sign in again to request another.",
            401,
          );
        }
        if (
          sessionCookieName(req) === "hic_admin_session" &&
          otp.role !== "admin"
        )
          throw fail("This workspace is for administrators.", 403);
        const matches = timingSafeEqual(
          Buffer.from(otp.code_hash, "hex"),
          Buffer.from(hash(challenge + ":" + code), "hex"),
        );
        if (!matches) {
          await connection.execute(
            "UPDATE admin_login_otps SET attempts=attempts+1 WHERE user_id=?",
            [otp.user_id],
          );
          await connection.commit();
          throw fail(
            "Incorrect code. Check your email and try again. Each code allows five attempts.",
            401,
          );
        }
        const token = randomBytes(32).toString("hex");
        await connection.execute(
          "INSERT INTO sessions(token_hash,user_id,expires_at,email_otp_verified) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR),1)",
          [hash(token), otp.user_id],
        );
        await connection.execute(
          "DELETE FROM admin_login_otps WHERE user_id=?",
          [otp.user_id],
        );
        await connection.execute(
          "INSERT INTO audit_log(actor_id,action) VALUES (?,?)",
          [otp.user_id, "verify-email-login"],
        );
        await connection.commit();
        res.cookie(sessionCookieName(req), token, {
          ...sessionCookie(),
          maxAge: 28800000,
        });
        res.json({
          id: otp.user_id,
          email: otp.email,
          name: otp.name,
          role: otp.role,
        });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }),
  );
}
