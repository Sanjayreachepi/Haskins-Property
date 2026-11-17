import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import {
  Archivo, Instrument_Serif, IBM_Plex_Mono, Oswald, Barlow_Condensed, Bebas_Neue, Anton, Inter,
  Playfair_Display, DM_Serif_Display, Fraunces, JetBrains_Mono, Space_Mono,
} from "next/font/google";
import "./theme.css";
import "./globals.css";
import "./shell.css";
import "./ui.css";
import { Header, Footer } from "../components/shell";
import { getSettings } from "../lib/settings";
import { siteUrl } from "../lib/site";
import { pageBlocks } from "@haskins/shared";
import JsonLd from "../components/json-ld";
import { organizationSchema, websiteSchema } from "../lib/schema";
import { getProperties, imageSrc } from "../lib/content";
import { getPage, block } from "../lib/seo";
import { designCss } from "../lib/design";
import ConsentManager from "../components/consent";
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--ff-display", display: "swap" });
const accent = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--ff-accent", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--ff-mono", display: "swap" });
// Optional fonts staff can pick in the admin (Design). Browsers only download a font that is actually used.
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-oswald" });
const barlow = Barlow_Condensed({ subsets: ["latin"], display: "swap", preload: false, weight: ["600", "700", "800"], variable: "--ff-barlow" });
const bebas = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--ff-bebas" });
const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--ff-anton" });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--ff-playfair" });
const dmserif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: "400", style: ["normal", "italic"], variable: "--ff-dmserif" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--ff-fraunces" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-jetbrains" });
const spacemono = Space_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--ff-spacemono" });
const extra = [oswald, barlow, bebas, anton, inter, playfair, dmserif, fraunces, jetbrains, spacemono];
export async function generateMetadata(): Promise<Metadata> {
  const st = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    applicationName: st.siteName,
    title: {
      default: `${st.siteName} | South San Francisco`,
      template: `%s | ${st.siteName}`,
    },
    description: st.defaultDescription,
    formatDetection: { telephone: false },
    verification: {
      ...(st.googleVerification ? { google: st.googleVerification } : {}),
      ...(st.bingVerification ? { other: { "msvalidate.01": st.bingVerification } } : {}),
    },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rendered per request: the Content-Security-Policy nonce (set in proxy.ts) can only be applied to
  // dynamically rendered pages.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const settings = await getSettings();
  const [layoutPage, designPage] = await Promise.all([getPage("layout"), getPage("design")]);
  const lb = (k: string) => block(layoutPage, "layout", k);
  const data: Record<string, string> = {};
  for (const k of pageBlocks.layout.map((x) => x.key)) data[k] = lb(k);
  for (let i = 1; i <= 4; i++) data[`frame${i}Image`] = imageSrc(data[`frame${i}Image`]) || "";
  const css = designCss((k) => block(designPage, "design", k));
  const haskinsWayLandOnly =
    (await getProperties()).find((p) => p.slug === "400-450-e-jamie")?.landOnly ?? true;
  return (
    <html
      lang="en"
      className={`${display.variable} ${accent.variable} ${mono.variable} ${extra.map((f) => f.variable).join(" ")}`}
      // Browser extensions (translate, dark-mode, ad-block…) often add attributes to <html>/<body>
      // before React loads, which triggers a harmless hydration warning.
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />
        <JsonLd data={[organizationSchema(settings), websiteSchema(settings)]} />
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header data={data} />
        <main id="main">{children}</main>
        <Footer settings={settings} haskinsWayLandOnly={haskinsWayLandOnly} data={data} />
        <ConsentManager gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} nonce={nonce} />
      </body>
    </html>
  );
}
