/**
 * Pre-launch password gate for the public site.
 *
 * Turned on by the SITE_PASSWORD environment variable (apps/web/.env.local or the production env).
 * Leave it empty / unset and the site is public. The access cookie holds an HMAC of a fixed label
 * keyed by the password, so changing the password signs everyone out. Web Crypto only, so this
 * works in any runtime the proxy runs in.
 */
export const ACCESS_COOKIE = "hic_site_access";
export const ACCESS_PATH = "/site-access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const sitePassword = () => (process.env.SITE_PASSWORD || "").trim();
export const gateEnabled = () => sitePassword().length > 0;

const enc = new TextEncoder();

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Value stored in the access cookie for the current password. */
export const accessToken = () => hmacHex(sitePassword(), "hic-site-access-v1");

/** Constant-time string comparison (both sides are hashed first so lengths always match). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmacHex("cmp", a), hmacHex("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function hasAccess(cookieValue: string | undefined): Promise<boolean> {
  if (!gateEnabled()) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await accessToken());
}

export async function passwordMatches(input: string): Promise<boolean> {
  return gateEnabled() && safeEqual(input, sitePassword());
}

/** Only same-site paths are allowed as the return address (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith(ACCESS_PATH)) return "/";
  return next;
}
