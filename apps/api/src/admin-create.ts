import { rows, db } from "./db";
import { passwordHash } from "./security";
async function main() {
  const email = process.env.ADMIN_EMAIL,
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password.length > 256)
    throw Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters)");
  await rows(
    "INSERT INTO users(email,password_hash,role) VALUES (?,?,'admin')",
    [email.toLowerCase(), passwordHash(password)],
  );
  console.log("Administrator created");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
