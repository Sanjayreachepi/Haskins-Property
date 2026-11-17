"use client";
import { SmartLink as Link } from "../lib/links";
import { usePathname } from "next/navigation";
import type { SiteSettings } from "../lib/settings";
import { CookieSettingsButton } from "./consent";
import { useEffect, useState } from "react";
export type ShellData = Record<string, string>;
const pair = (d: ShellData, l: string, u: string): [string, string] | null =>
  d[l] ? [d[u] || "/", d[l]] : null;
export function Header({ data }: { data: ShellData }) {
  const links = [1, 2, 3, 4, 5, 6].map((i) => pair(data, `nav${i}Label`, `nav${i}Url`)).filter(Boolean) as [string, string][];
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () =>
      root.toggleAttribute("data-scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-scrolled");
    };
  }, []);
  return (
    <>
      <div className="topbar">
        <span>{data.topbarText}</span>
        {data.topbarLinkLabel && (
          <Link href={data.topbarLinkUrl || "/"}>
            {data.topbarLinkLabel} <span>↗</span>
          </Link>
        )}
      </div>
      <header>
        <Link href="/" aria-label="Haskins home">
          <img
            className="logo"
            src="/images/logo.png"
            alt={data.headerLogoAlt}
          />
        </Link>
        <button
          className="menu"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? "Close ×" : "Menu ☰"}
        </button>
        <nav className={open ? "open" : ""}>
          {links.map(([url, label]) => (
            <Link
              aria-current={path.startsWith(url) && url !== "/" ? "page" : undefined}
              onClick={() => setOpen(false)}
              key={url}
              href={url}
            >
              {label}
            </Link>
          ))}
          {data.navPortalLabel && (
            <Link
              onClick={() => setOpen(false)}
              className="navportal"
              href={data.navPortalUrl || "/"}
            >
              {data.navPortalLabel}
            </Link>
          )}
        </nav>
      </header>
    </>
  );
}
export function Footer({
  settings,
  haskinsWayLandOnly = true,
  data,
}: {
  data: ShellData;
  settings?: SiteSettings;
  /** the Haskins Way / E. Jamie Ct. photo must say the building is not owned */
  haskinsWayLandOnly?: boolean;
}) {
  const frames = [1, 2, 3, 4].map((i) => [data[`frame${i}Image`], data[`frame${i}Caption`]]).filter(([img]) => img);
  const col = (c: number) =>
    [1, 2, 3, 4].map((i) => pair(data, `footCol${c}Link${i}Label`, `footCol${c}Link${i}Url`)).filter(Boolean) as [string, string][];
  return (
    <footer className="ft">
      <div className="ft-reel-wrap" aria-hidden="true">
        <div className="ft-sprockets" />
        <div className="ft-reel">
          {/* 6 sets (two identical halves) so the strip never runs out on wide screens */}
          {[...frames, ...frames, ...frames, ...frames, ...frames, ...frames].map(([img, cap0], i) => {
            const cap = haskinsWayLandOnly ? cap0 : cap0.replace(" (land only)", "");
            return (
            <figure className="ft-frame" key={i}>
              <img src={img} alt="" loading="lazy" />
              <figcaption className="mono">{cap}</figcaption>
            </figure>
            );
          })}
        </div>
        <div className="ft-sprockets" />
      </div>
      <div className="ft-wrap">
        <div className="ft-top">
          <div className="ft-brand">
            <img
              className="ft-logo"
              src="/images/logo.png"
              alt={data.footerLogoAlt}
            />
            <h2 className="ft-h">
              <span className="disp">{data.footerHeading1}</span>
              <span className="serif">{data.footerHeading2}</span>
            </h2>
          </div>
          <div className="ft-cols">
            {[1, 2].map((c) => (
              <div className="ft-col" role="navigation" aria-label={data[`footCol${c}Title`]} key={c}>
                <span className="mono">{data[`footCol${c}Title`]}</span>
                {col(c).map(([url, label]) => (
                  <Link className="ft-link" href={url} key={url + label}>{label}</Link>
                ))}
              </div>
            ))}
            <div className="ft-col">
              <span className="mono">{data.footMgmtTitle}</span>
              <span className="ft-name">{data.footMgmtName}</span>
              <span className="ft-addr ft-addr-lines">
                {settings?.address || "South San Francisco, CA 94080"}
              </span>
              {settings?.phone && (
                <a className="ft-link" href={settings.tel || undefined}>
                  {settings.phone}
                </a>
              )}
              {settings?.email && (
                <a className="ft-link" href={settings.mailto || undefined}>
                  {settings.email}
                </a>
              )}
              <Link className="ft-cta" href={data.footContactUrl || "/contact"}>
                {data.footContactLabel}
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
                  <path d="M6 18 18 6M8 6h10v10" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
        <div className="ft-legal">
          <p>{data.footLegal}</p>
          <span className="mono">
            <span>© {new Date().getFullYear()} {data.footCopyright}</span>
            <Link href="/privacy">{data.footPrivacyLabel}</Link>
            <Link href="/account">My account</Link>
            <CookieSettingsButton className="ft-cookie" />
          </span>
        </div>
      </div>
    </footer>
  );
}
