import { randomBytes } from "node:crypto";
import { rows } from "../src/db";
import { hash } from "../src/security";
/** Fixture for CMS/role suites without SMTP. Full delivery/password flow is covered by test:portal. */
export async function seedAdminChallenge(userId: number) {
  const challenge = randomBytes(32).toString("hex"),
    code = "123456";
  await rows(
    "INSERT INTO admin_login_otps(user_id,challenge_hash,code_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) ON DUPLICATE KEY UPDATE challenge_hash=VALUES(challenge_hash),code_hash=VALUES(code_hash),attempts=0,expires_at=VALUES(expires_at)",
    [userId, hash(challenge), hash(challenge + ":" + code)],
  );
  return { challenge, code };
}
