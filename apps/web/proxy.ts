import { NextRequest, NextResponse } from "next/server";
import { normalize, parseRedirects, type Redirect } from "./lib/redirects";

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

export async function proxy(request: NextRequest) {
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
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
