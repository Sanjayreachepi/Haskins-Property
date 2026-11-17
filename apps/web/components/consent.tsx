"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fired by the footer / privacy page buttons to open the cookie preferences. */
export const OPEN_COOKIE_SETTINGS = "hk-open-cookie-settings";
export const openCookieSettings = () =>
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));

const KEY = "hk_consent";
type Choice = "all" | "essential" | null;

const read = (): Choice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Cookie consent.
 *  - Without a Google Analytics ID the site sets no optional cookies: there is no banner,
 *    and "Cookie settings" just explains that.
 *  - With NEXT_PUBLIC_GA_MEASUREMENT_ID, analytics load ONLY after the visitor accepts.
 *    A browser "Global Privacy Control" signal counts as declining. The choice can be
 *    changed at any time from "Cookie settings" in the footer.
 */
export default function ConsentManager({
  gaId,
  nonce,
}: {
  gaId?: string;
  nonce?: string;
}) {
  const analyticsAvailable = !!gaId && /^G-[A-Z0-9]+$/.test(gaId);
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [gpc, setGpc] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGpc(
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl === true,
    );
    setChoice(read());
    setReady(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, onOpen);
  }, []);

  const save = useCallback(
    (next: Exclude<Choice, null>) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage blocked: the choice just won't persist */
      }
      if (gaId) {
        const allowed = next === "all" && !gpc;
        (window as unknown as Record<string, unknown>)["ga-disable-" + gaId] = !allowed;
        const analytics = window as unknown as { gtag?: (...args: unknown[]) => void };
        analytics.gtag?.("consent", "update", {
          analytics_storage: allowed ? "granted" : "denied",
        });
      }
      if (next !== "all" && gaId) {
        // withdraw: stop the tag and remove any analytics cookies already set
        (window as unknown as Record<string, unknown>)["ga-disable-" + gaId] = true;
        for (const c of document.cookie.split(";")) {
          const name = c.split("=")[0].trim();
          if (name === "_ga" || name.startsWith("_ga_"))
            document.cookie = `${name}=; Max-Age=0; path=/`;
        }
      }
      setChoice(next);
      setOpen(false);
    },
    [gaId, gpc],
  );

  // keyboard: Esc closes, focus moves into the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const effective: Choice = gpc && analyticsAvailable ? "essential" : choice;
  const showBanner = ready && analyticsAvailable && !gpc && choice === null && !open;

  return (
    <>
      {ready && analyticsAvailable && effective === "all" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {showBanner && (
        <div className="ck-banner" role="region" aria-label="Cookie notice">
          <p>
            We would like to use analytics cookies to understand how this site is
            used. They stay off unless you accept.{" "}
            <a href="/privacy">Privacy &amp; cookies</a>
          </p>
          <div className="ck-actions">
            <button type="button" className="ck-btn ck-ghost" onClick={() => save("essential")}>
              Essential only
            </button>
            <button type="button" className="ck-btn" onClick={() => save("all")}>
              Accept analytics
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="ck-overlay" onClick={() => setOpen(false)}>
          <div
            ref={panel}
            className="ck-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ck-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="ck-eyebrow">Privacy &amp; cookies</span>
            <h2 id="ck-title">Cookie settings</h2>
            <div className="ck-row">
              <div>
                <strong>Essential</strong>
                <p>
                  Needed for the site to work. This site does not set tracking
                  or advertising cookies.
                </p>
              </div>
              <span className="ck-pill">Always on</span>
            </div>
            <div className="ck-row">
              <div>
                <strong>Analytics</strong>
                <p>
                  {analyticsAvailable
                    ? gpc
                      ? "Your browser sends a Global Privacy Control signal, so analytics stay off."
                      : "Helps us understand which pages are useful. Off unless you accept."
                    : "Not in use on this site at the moment."}
                </p>
              </div>
              {analyticsAvailable && !gpc ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={effective === "all"}
                  aria-label="Analytics cookies"
                  className="ck-switch"
                  onClick={() => save(effective === "all" ? "essential" : "all")}
                />
              ) : (
                <span className="ck-pill ck-off">Off</span>
              )}
            </div>
            <div className="ck-actions">
              <button type="button" className="ck-btn" onClick={() => setOpen(false)}>
                Close
              </button>
              <a className="ck-link" href="/privacy">
                Read the privacy information
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Button that opens the cookie preferences (footer, privacy page). */
export function CookieSettingsButton({
  className,
  children = "Cookie settings",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      {children}
    </button>
  );
}
