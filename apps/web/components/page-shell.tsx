import type { ReactNode } from "react";
import HomeEffects from "./home-effects";
import JsonLd from "./json-ld";
import { breadcrumbSchema } from "../lib/schema";
import "../app/home.css";

/**
 * Wrapper for every redesigned page: loads the shared section styles (`hk-*`),
 * the scroll-reveal / progress behaviour, and scopes them under `.home`.
 */
export default function PageShell({
  children,
  crumb,
}: {
  children: ReactNode;
  /** adds BreadcrumbList structured data: Home › <crumb> */
  crumb?: { name: string; path: string }[];
}) {
  return (
    <div className="home hk-inner">
      {crumb && <JsonLd data={breadcrumbSchema(crumb)} />}
      <HomeEffects />
      {children}
    </div>
  );
}
