import { NextRequest, NextResponse } from "next/server";
import { normalize, parseRedirects, type Redirect } from "./lib/redirects";
import { ACCESS_COOKIE, ACCESS_PATH, gateEnabled, hasAccess } from "./lib/site-access";

/**
 * Per-request Content-Security-Policy with a nonce (Next.js applies the nonce to its own scripts and
 * styles automatically). Scripts can run only if they carry this request's nonce — injected or
 * third-party scripts are blocked. Pages must render dynamically for this to work (see the root layout).
 */
const isDev = process.env.NODE_ENV === "development";
const API = process.env.API_URL || "http://127.0.0.1:4000";

const origin = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
};
const publicApi = origin(process.env.NEXT_PUBLIC_API_URL || API);
const analytics = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "");

/**
 * Redirects managed in the admin (Site settings → Redirects). The list is fetched from the API and
 * cached for a minute; if the API is unreachable the last known list keeps working.
 */
let redirectMap = new Map<string, Redirect>();
let redirectsLoadedAt = 0;
async function redirectFor(pathname: string): Promise<Redirect | undefined> {
  if (Date.now() - redirectsLoadedAt > 60_000) {
    redirectsLoadedAt = Date.now(); // set first so a slow API is not hammered
    try {
      const r = await fetch(API + "/api/public/content", {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      });
      if (r.ok) {
        const recs = (await r.json()) as { kind: string; payload?: { redirects?: string } }[];
        const text = recs.find((x) => x.kind === "settings")?.payload?.redirects ?? "";
        redirectMap = new Map(parseRedirects(text).map((x) => [x.from, x]));
      }
    } catch {
      /* keep the previous list */
    }
  }
  return redirectMap.get(normalize(pathname));
}

/** Files the password page itself needs (logo); everything else is behind the gate. */
const GATE_OPEN = new Set(["/images/logo.svg", "/favicon.ico"]);

/**
 * Pre-launch password gate (SITE_PASSWORD). Returns a response when the request must be stopped,
 * or null when it may continue.
 */
async function gate(request: NextRequest): Promise<NextResponse | null> {
  if (!gateEnabled()) return null;
  const { pathname, search } = request.nextUrl;
  if (pathname === ACCESS_PATH || GATE_OPEN.has(pathname)) return null;
  if (await hasAccess(request.cookies.get(ACCESS_COOKIE)?.value)) return null;
  // robots.txt: tell crawlers to stay out entirely while the site is private
  if (pathname === "/robots.txt")
    return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
  const isPage =
    (request.method === "GET" || request.method === "HEAD") &&
    !pathname.startsWith("/api/") &&
    !request.headers.has("next-router-prefetch") &&
    !request.headers.get("rsc");
  if (!isPage) return new NextResponse("Password required", { status: 401 });
  const url = new URL(ACCESS_PATH, request.url);
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url, 307);
}

export async function proxy(request: NextRequest) {
  const blocked = await gate(request);
  if (blocked) {
    blocked.headers.set("X-Robots-Tag", "noindex, nofollow");
    blocked.headers.set("Cache-Control", "no-store");
    return blocked;
  }
  const { pathname } = request.nextUrl;
  const pagePath =
    !pathname.startsWith("/api/") &&
    !/^\/(robots\.txt|sitemap\.xml|images\/|favicon\.ico)/.test(pathname) &&
    !request.headers.has("next-router-prefetch") &&
    request.headers.get("purpose") !== "prefetch";
  if (!pagePath) {
    const res = NextResponse.next();
    if (gateEnabled()) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    const rule = await redirectFor(request.nextUrl.pathname);
    if (rule) {
      const target = rule.to.startsWith("https://")
        ? new URL(rule.to)
        : new URL(rule.to, request.url);
      return NextResponse.redirect(target, rule.status);
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a nonced script (e.g. Google's tag, after consent) are trusted
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${analytics ? " https://www.googletagmanager.com" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'", // React style="" attributes (cannot carry a nonce; not a script vector)
    `img-src 'self' data: blob:${publicApi ? " " + publicApi : ""}${analytics ? " https://www.google-analytics.com https://*.googletagmanager.com" : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${publicApi ? " " + publicApi : ""}${analytics ? " https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (gateEnabled()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Everything except Next's own build assets and the favicon: the password gate must also cover
  // /api, images, robots.txt and sitemap.xml. CSP + redirects still apply to pages only (see pagePath).
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
