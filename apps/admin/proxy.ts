import { NextRequest, NextResponse } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce (Next.js applies the nonce to its own scripts and
 * styles automatically). Scripts can run only if they carry this request's nonce — injected or
 * third-party scripts are blocked. Pages must render dynamically for this to work (see the root layout).
 */
const isDev = process.env.NODE_ENV === "development";
const webOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").origin;
  } catch {
    return "";
  }
})();

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a nonced script (e.g. Google's tag, after consent) are trusted
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'", // React style="" attributes (cannot carry a nonce; not a script vector)
    `img-src 'self' data: blob:${webOrigin ? " " + webOrigin : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
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
