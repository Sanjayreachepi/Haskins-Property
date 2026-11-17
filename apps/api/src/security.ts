import {
  createHash,
  scryptSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { rows } from "./db";
export const roles = ["admin", "user", "tenant"] as const;
export type Role = (typeof roles)[number];
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export const text = (value: unknown, max = 20000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export const secret = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 256) : "";
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export const wrap =
  (handler: (req: any, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => {
        req.body ??= {};
        return handler(req, res);
      })
      .catch(next);
  };
export function sessionCookieName(req: Request) {
  return /^\/api\/admin(?:\/|$)/.test(req.originalUrl)
    ? "hic_admin_session"
    : "hic_session";
}
export function cookie(req: Request) {
  const read = (name: string) =>
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1);
  // Keep existing sessions working until the administrator signs in again.
  return read(sessionCookieName(req)) ?? read("hic_session") ?? "";
}
export async function authenticate(req: any) {
  const token = cookie(req);
  if (!token) throw fail("Please sign in", 401);
  const [account] = await rows(
    "SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1",
    [hash(token)],
  );
  if (!account) throw fail("Session expired. Please sign in.", 401);
  req.account = account;
}
export function requireRole(req: any, ...allowed: Role[]) {
  if (!req.account || !allowed.includes(req.account.role))
    throw fail("You do not have permission to access this resource", 403);
}
export async function audit(
  req: any,
  action: string,
  id: number | null = null,
) {
  await rows(
    "INSERT INTO audit_log(actor_id,action,record_id) VALUES (?,?,?)",
    [req.account.id, action, id],
  );
}

/** Session cookie options: HttpOnly + SameSite=Strict, and Secure whenever in production or COOKIE_SECURE=true. */
export const sessionCookie = () => ({
  httpOnly: true,
  sameSite: "strict" as const,
  secure:
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  path: "/api",
});

/** Verifies a password against a stored "salt:hash" (used for the default-admin check). */
export function passwordMatches(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
