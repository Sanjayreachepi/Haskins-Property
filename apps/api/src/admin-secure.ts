import { db } from "./db";
import { passwordHash, passwordMatches } from "./security";

/** Explicit deployment operation: keeps the original account ID/audit/ownership references. */
async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email === "admin@gmail.com" ||
    password.length < 12 ||
    password.length > 256 ||
    password === "admin@123"
  )
    throw Error(
      "Set a non-default ADMIN_EMAIL and unique ADMIN_PASSWORD (12–256 characters) in a protected environment. Credentials are never printed.",
    );
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [found]: any = await connection.execute(
      "SELECT id,password_hash FROM users WHERE email='admin@gmail.com' AND role='admin' FOR UPDATE",
    );
    if (!found[0] || !passwordMatches("admin@123", found[0].password_hash))
      throw Error(
        "Unchanged default administrator not found. Use My account/Accounts to change an existing secured account.",
      );
    const id = found[0].id;
    const [duplicate]: any = await connection.execute(
      "SELECT id FROM users WHERE email=?",
      [email],
    );
    if (duplicate.length)
      throw Error(
        "Target email already belongs to an account; no accounts were changed.",
      );
    if (!process.argv.includes("--apply")) {
      await connection.rollback();
      console.log(
        "DRY RUN: default administrator can be renamed and password rotated. Add --apply to perform the operation and revoke its sessions.",
      );
      return;
    }
    await connection.execute(
      "UPDATE users SET email=?,password_hash=? WHERE id=?",
      [email, passwordHash(password), id],
    );
    await connection.execute("DELETE FROM sessions WHERE user_id=?", [id]);
    await connection.execute("DELETE FROM password_tokens WHERE user_id=?", [
      id,
    ]);
    await connection.execute("DELETE FROM mfa_challenges WHERE user_id=?", [
      id,
    ]);
    await connection.execute(
      "INSERT INTO audit_log(actor_id,action) VALUES (?,?)",
      [id, "secure-default-admin"],
    );
    await connection.commit();
    console.log(
      "Default administrator secured. Existing account ID/MFA retained; sessions and outstanding reset/login challenges revoked. Sign in with the supplied credentials.",
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
main()
  .catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
