import type { BlockType, PageBlock } from "./page-blocks";
import designTokens from "../design-tokens.json";

/** Fonts the admin can choose from. `var` is the next/font CSS variable loaded by the website. */
export const fontChoices: Record<"display" | "accent" | "mono", { key: string; label: string; var: string; fallback: string }[]> = designTokens.fontChoices;
export const fontKeys = [
  ...fontChoices.display,
  ...fontChoices.accent,
  ...fontChoices.mono,
].map((f) => f.key);

/** Which kind of value a block holds (decided by its key; used by admin editor, API validation and site). */
export function blockType(key: string, explicit?: BlockType): BlockType {
  if (explicit) return explicit;
  if (/Image$/.test(key)) return "image";
  if (/Url$/.test(key)) return "url";
  if (/^color[A-Z]/.test(key)) return "color";
  if (/^font[A-Z]/.test(key)) return "font";
  if (/^num[A-Z]/.test(key)) return "number";
  return "text";
}

const t = (group: string, key: string, label: string, def: string, multiline = false): PageBlock => ({
  key,
  label,
  default: def,
  group,
  ...(multiline ? { multiline: true } : {}),
});

const IMG = "/images/";

/* ------------------------------------------------------------------ HOME */
export const homeBlocks: PageBlock[] = [
  // Hero
  t("1 · Hero", "heroKicker", "Small label above the headline", "South San Francisco · California"),
  t("1 · Hero", "heroLine1", "Headline — line 1", "An industrial"),
  t("1 · Hero", "heroLine2", "Headline — line 2", "legacy."),
  t("1 · Hero", "heroAccent", "Headline — italic line", "a lasting commitment."),
  t("1 · Hero", "heroText", "Text under the headline", "Family-owned properties. Practical spaces. A place in the Bay Area to build your future.", true),
  t("1 · Hero", "heroBtn1Label", "Button 1 — label", "Explore our properties"),
  t("1 · Hero", "heroBtn1Url", "Button 1 — link", "/properties"),
  t("1 · Hero", "heroBtn2Label", "Button 2 — label", "Our story"),
  t("1 · Hero", "heroBtn2Url", "Button 2 — link", "/history"),
  t("1 · Hero", "heroImage", "Hero photo", IMG + "buzz_haskins_yard_monitor_bg_1920_1080.webp"),
  t("1 · Hero", "heroImageAlt", "Hero photo — description (alt text)", "Archival black-and-white aerial photograph of the Haskins industrial property"),
  t("1 · Hero", "heroFigTop", "Photo label — top", "Fig. 01 — Archival aerial"),
  t("1 · Hero", "heroFigBottom", "Photo label — bottom", "The Haskins property"),
  t("1 · Hero", "heroBadge", "Rotating badge text (repeats around the circle)", "FAMILY OWNED · SOUTH SAN FRANCISCO · ROOTED HERE · "),
  t("1 · Hero", "quick1Label", "Quick link 1 — label", "Find a property"),
  t("1 · Hero", "quick1Url", "Quick link 1 — link", "/properties"),
  t("1 · Hero", "quick2Label", "Quick link 2 — label", "Explore available space"),
  t("1 · Hero", "quick2Url", "Quick link 2 — link", "/available-spaces"),
  t("1 · Hero", "quick3Label", "Quick link 3 — label", "Tenant resources"),
  t("1 · Hero", "quick3Url", "Quick link 3 — link", "/tenant-portal"),
  // Ticker
  t("2 · Scrolling words", "marqueeWords", "Words in the scrolling band (one per line)", "Industrial\nWarehouse\nOffice\nParking\nYard\nFamily owned\nSouth San Francisco", true),
  t("2 · Scrolling words", "marqueeAccent", "Word shown in italic serif", "Family owned"),
  // Intro
  t("3 · Introduction", "introKicker", "Small label", "Established here. Invested here."),
  t("3 · Introduction", "introLine1", "Headline — line 1", "More than a location."),
  t("3 · Introduction", "introLine2", "Headline — italic line", "A long-term perspective."),
  t("3 · Introduction", "introLead", "Lead sentence", "A portfolio of family-owned real estate in the heart of South San Francisco.", true),
  t("3 · Introduction", "introBody", "Paragraph", "Our roots in this industrial community shape how we care for our properties today: with practical knowledge, personal attention and a commitment to the people who work here.", true),
  t("3 · Introduction", "introBtnLabel", "Button — label", "Discover our story"),
  t("3 · Introduction", "introBtnUrl", "Button — link", "/history"),
  t("3 · Introduction", "introImage1Image", "Large photo", IMG + "69-s-linden-ave-main-office.webp"),
  t("3 · Introduction", "introImage1Alt", "Large photo — description (alt text)", "69 South Linden Avenue office and warehouse"),
  t("3 · Introduction", "introCaption", "Large photo — caption", "69 S. Linden Avenue"),
  t("3 · Introduction", "introImage2Image", "Small photo", IMG + "114-s-maple-ave-warehouse.webp"),
  t("3 · Introduction", "introImage2Alt", "Small photo — description (alt text)", "114 South Maple Avenue warehouse"),
  t("3 · Introduction", "introBadge", "Rotating badge text", "FAMILY OWNED · INVESTED HERE · ESTABLISHED HERE · "),
  t("3 · Introduction", "stat1Label", "Counter 1 — label (number is automatic)", "Properties"),
  t("3 · Introduction", "stat2Label", "Counter 2 — label (number is automatic)", "Separate legal entities"),
  t("3 · Introduction", "stat3Label", "Counter 3 — label (number is automatic)", "Cities"),
  // Pillars
  t("4 · Three features", "pillar1Label", "Feature 1 — small label", "01 / Location"),
  t("4 · Three features", "pillar1Title", "Feature 1 — title", "Connected location"),
  t("4 · Three features", "pillar1Text", "Feature 1 — description", "South San Francisco, close to the Bay Area’s major transportation routes.", true),
  t("4 · Three features", "pillar2Label", "Feature 2 — small label", "02 / Space"),
  t("4 · Three features", "pillar2Title", "Feature 2 — title", "Space that works"),
  t("4 · Three features", "pillar2Text", "Feature 2 — description", "Industrial, office, parking and yard properties for a range of business needs.", true),
  t("4 · Three features", "pillar3Label", "Feature 3 — small label", "03 / Stewardship"),
  t("4 · Three features", "pillar3Title", "Feature 3 — title", "Personal stewardship"),
  t("4 · Three features", "pillar3Text", "Feature 3 — description", "Family ownership supported by experienced property administration.", true),
  // Portfolio
  t("5 · Portfolio", "portfolioKicker", "Small label", "The portfolio"),
  t("5 · Portfolio", "portfolioWord1", "Headline — first word(s)", "Spaces"),
  t("5 · Portfolio", "portfolioWord2", "Headline — italic word(s)", "with purpose."),
  t("5 · Portfolio", "portfolioBtnLabel", "Button — label", "View all properties"),
  t("5 · Portfolio", "portfolioBtnUrl", "Button — link", "/properties"),
  // Then & now
  t("6 · Then and now", "thenKicker", "Small label", "Then and now"),
  t("6 · Then and now", "then1", "Headline — line 1", "The earth"),
  t("6 · Then and now", "then2", "Headline — line 2", "moves with"),
  t("6 · Then and now", "then3", "Headline — line 3 (not shown: the site uses the Haskins SVG logo here)", "Haskins."),
  t("6 · Then and now", "thenNowText", "Paragraph", "Our roots in the industrial equipment business gave us a deep understanding of this industry and this community. Today, we continue that legacy through responsible ownership and management of industrial properties.", true),
  t("6 · Then and now", "thenBtnLabel", "Button — label", "Our history"),
  t("6 · Then and now", "thenBtnUrl", "Button — link", "/history"),
  t("6 · Then and now", "compareBeforeImage", "“Then” photo", IMG + "buzz_haskins_yard_monitor_bg_1920_1080.webp"),
  t("6 · Then and now", "compareBeforeAlt", "“Then” photo — description (alt text)", "1960s aerial photograph of the Haskins industrial yard"),
  t("6 · Then and now", "compareAfterImage", "“Today” photo", IMG + "haskins-way-and-e-jamie-ct-aerial.webp"),
  t("6 · Then and now", "compareAfterAlt", "“Today” photo — description (alt text)", "Present-day aerial of the area around Haskins Way and E. Jamie Court"),
  t("6 · Then and now", "compareHint", "Slider hint", "Drag to compare"),
  t("6 · Then and now", "compareCaption", "Slider caption", "Haskins Way & E. Jamie Ct."),
  t("6 · Then and now", "landLabel", "Land-only note — bold start (legal wording — change only with owner approval)", "Land only."),
  t("6 · Then and now", "landNote", "Land-only note — text (legal wording — change only with owner approval)", "Haskins does not own the building shown in the “Today” photo — only the land beneath it, held under a ground lease (400/450 E. Jamie Ct.).", true),
  // History
  t("7 · History teaser", "historyKicker", "Small label", "Our history, our foundation"),
  t("7 · History teaser", "history1", "Headline — line 1", "The earth moves."),
  t("7 · History teaser", "history2", "Headline — italic line", "Our roots remain."),
  t("7 · History teaser", "historyLead", "Lead paragraph", "From Arthur “Buzz” Haskins’ contracting legacy to the family’s real-estate holdings today, our story is woven into the Bay Area.", true),
  t("7 · History teaser", "historyBody", "Second paragraph", "That hands-on experience continues through the thoughtful stewardship of the properties in our care.", true),
  t("7 · History teaser", "historyBtnLabel", "Button — label", "Explore our history"),
  t("7 · History teaser", "historyBtnUrl", "Button — link", "/history"),
  t("7 · History teaser", "historyImage", "Archive photo", IMG + "scrapers_2b.webp"),
  t("7 · History teaser", "historyImageAlt", "Archive photo — description (alt text)", "Archive photograph of Haskins bulldozers and a scraper moving earth"),
  t("7 · History teaser", "historyCaption", "Archive photo — caption", "From our family archive"),
  // Tenants
  t("8 · Tenant band", "tenantKicker", "Small label", "Already part of the community?"),
  t("8 · Tenant band", "tenant1", "Headline — line 1", "Your property."),
  t("8 · Tenant band", "tenant2", "Headline — italic line", "Your resources."),
  t("8 · Tenant band", "tenantText", "Text", "Find management contacts, tenant information and payment guidance in one place.", true),
  t("8 · Tenant band", "tenantBtnLabel", "Button — label", "Visit the tenant portal"),
  t("8 · Tenant band", "tenantBtnUrl", "Button — link", "/tenant-portal"),
  t("8 · Tenant band", "tenantLink1Label", "Quick link 1 — label", "Management contacts"),
  t("8 · Tenant band", "tenantLink1Url", "Quick link 1 — link", "/contact"),
  t("8 · Tenant band", "tenantLink2Label", "Quick link 2 — label", "Tenant information"),
  t("8 · Tenant band", "tenantLink2Url", "Quick link 2 — link", "/tenant-portal"),
  t("8 · Tenant band", "tenantLink3Label", "Quick link 3 — label", "Payment guidance"),
  t("8 · Tenant band", "tenantLink3Url", "Quick link 3 — link", "/pay-rent"),
  // CTA
  t("9 · Closing banner", "ctaKicker", "Small label", "A place to build your business"),
  t("9 · Closing banner", "cta1", "Headline — line 1", "Rooted here."),
  t("9 · Closing banner", "cta2", "Headline — italic line", "Ready for what’s next."),
  t("9 · Closing banner", "ctaBtnLabel", "Button — label", "Connect with management"),
  t("9 · Closing banner", "ctaBtnUrl", "Button — link", "/contact"),
];

/* ------------------------------------------------------ HEADER & FOOTER */
const navDefaults: [string, string][] = [
  ["Properties", "/properties"],
  ["Available spaces", "/available-spaces"],
  ["Our services", "/services"],
  ["Our history", "/history"],
  ["Contact", "/contact"],
  ["", ""],
];
const frameDefaults: [string, string, string][] = [
  ["scrapers_2b", "Haskins bulldozers moving earth, from the family archive", "Frame 01 — Family archive"],
  ["scrapers_1b", "Historic Haskins scraper equipment", "Frame 02 — Equipment"],
  ["buzz_haskins_yard_monitor_bg_1920_1080", "Archival aerial of the Haskins property", "Frame 03 — Archival aerial"],
  ["haskins-way-and-e-jamie-ct-aerial", "Present-day aerial near Haskins Way", "Frame 04 — Haskins Way (land only)"],
];
const footLinks: Record<string, [string, string][]> = {
  Explore: [["Our properties", "/properties"], ["Available spaces", "/available-spaces"], ["Our history", "/history"], ["", ""]],
  Resources: [["Tenant portal", "/tenant-portal"], ["Payment information", "/pay-rent"], ["Property services", "/services"], ["", ""]],
};

export const layoutBlocks: PageBlock[] = [
  t("Top bar", "topbarText", "Top bar text", "FAMILY OWNED · ROOTED IN SOUTH SAN FRANCISCO"),
  t("Top bar", "topbarLinkLabel", "Top bar link — label", "Tenant resources"),
  t("Top bar", "topbarLinkUrl", "Top bar link — address", "/tenant-portal"),
  t("Header", "headerLogoAlt", "Logo — description (alt text)", "Haskins Industrial Complex, LLC — South San Francisco, California"),
  ...navDefaults.flatMap(([l, u], i) => [
    t("Header menu", `nav${i + 1}Label`, `Menu item ${i + 1} — label (empty hides it)`, l),
    t("Header menu", `nav${i + 1}Url`, `Menu item ${i + 1} — link`, u),
  ]),
  t("Header menu", "navPortalLabel", "Highlighted button — label (empty hides it)", "Tenant portal ↗"),
  t("Header menu", "navPortalUrl", "Highlighted button — link", "/tenant-portal"),
  t("Footer", "footerLogoAlt", "Footer logo — description (alt text)", "Haskins Industrial Complex"),
  t("Footer", "footerHeading1", "Footer headline — line 1", "The earth moves."),
  t("Footer", "footerHeading2", "Footer headline — italic line", "Our roots remain."),
  ...Object.entries(footLinks).flatMap(([col, links], c) => [
    t(`Footer — column ${c + 1}`, `footCol${c + 1}Title`, `Column ${c + 1} — heading`, col),
    ...links.flatMap(([l, u], i) => [
      t(`Footer — column ${c + 1}`, `footCol${c + 1}Link${i + 1}Label`, `Link ${i + 1} — label (empty hides it)`, l),
      t(`Footer — column ${c + 1}`, `footCol${c + 1}Link${i + 1}Url`, `Link ${i + 1} — address`, u),
    ]),
  ]),
  t("Footer — management column", "footMgmtTitle", "Column heading", "Management"),
  t("Footer — management column", "footMgmtName", "Company name", "Buzz Haskins Equipment Co., Inc."),
  t("Footer — management column", "footContactLabel", "Contact button — label", "Contact"),
  t("Footer — management column", "footContactUrl", "Contact button — link", "/contact"),
  t("Footer — legal line", "footLegal", "Legal statement (change only with owner approval)", "This website is a central information portal for separately organized, family-owned real-estate entities. Individual properties are owned by the respective legal entities identified on each property page.", true),
  t("Footer — legal line", "footCopyright", "Copyright name (the year is automatic)", "Haskins Industrial Complex"),
  t("Footer — legal line", "footPrivacyLabel", "Privacy link — label", "Privacy & cookies"),
  ...frameDefaults.flatMap(([img, alt, cap], i) => [
    t("Footer film strip", `frame${i + 1}Image`, `Frame ${i + 1} — photo`, IMG + img + ".webp"),
    t("Footer film strip", `frame${i + 1}Caption`, `Frame ${i + 1} — caption`, cap),
  ]),
];

/* ---------------------------------------------------------------- DESIGN */
const c = (key: string, label: string, def: string) => t("Colors", key, label, def);
export const designBlocks: PageBlock[] = [
  t("Logo", "logoImage", "Footer logo (transparent SVG, light lettering for the dark footer)", IMG + "logo-light.svg"),
  c("colorPrimary", "Brand accent (buttons, highlights)", "#f2a900"),
  c("colorInk", "Dark background / dark text", "#121211"),
  c("colorInkDeep", "Top bar background", "#0b0b0a"),
  c("colorCard", "Cards on dark", "#1b1a18"),
  c("colorPaper", "Light sections", "#ffffff"),
  c("colorOnDark", "Text on dark", "#f3f0e9"),
  c("colorOnDarkMuted", "Secondary text on dark", "#a8a49b"),
  c("colorMutedLight", "Secondary text on light", "#4d4a43"),
  c("colorLineDark", "Lines on dark", "#2b2a27"),
  c("colorLineLight", "Lines on light", "#e2ded5"),
  t("Fonts", "fontDisplay", "Headline font", "archivo"),
  t("Fonts", "fontAccent", "Italic accent font", "instrument"),
  t("Fonts", "fontMono", "Small-label font", "plex"),
  t("Fonts", "numBodySize", "Body text size (px, 14–22)", "17"),
  t("Fonts", "numDisplayWidth", "Headline width (62 = condensed … 125 = wide; Archivo only)", "62"),
  t("Layout", "numContainer", "Maximum content width (px, 1000–1600)", "1328"),
];
export const numberRanges: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(designTokens.numberRanges).map(([key, [min, max]]) => [
    key,
    [min, max] as [number, number],
  ]),
);
