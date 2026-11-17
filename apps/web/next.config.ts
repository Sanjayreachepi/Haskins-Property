import type { NextConfig } from "next";

const API = process.env.API_URL || "http://127.0.0.1:4000";
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  transpilePackages: ["@haskins/shared"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Images/logos rarely change: let browsers and CDNs cache them (faster repeat visits, better Core Web Vitals).
      ...(isProd
        ? [
            {
              source: "/images/:path*",
              headers: [
                { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
              ],
            },
          ]
        : []),
    ];
  },
  async rewrites() {
    // Tenant sign-in: the browser talks to /api on this site so the session cookie is same-origin.
    // Only the public / tenant parts of the API are exposed here — never /api/admin/*
    // (the admin panel proxies its own API calls).
    return ["auth", "account", "tenant", "public", "media", "health"].map(
      (area) => ({
        source: `/api/${area}/:path*`,
        destination: `${API}/api/${area}/:path*`,
      }),
    );
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default config;
