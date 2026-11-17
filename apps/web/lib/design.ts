import { fontChoices } from "@haskins/shared";
import { imageSrc } from "./content";

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLORS: [string, string][] = [
  ["colorPrimary", "--color-primary"],
  ["colorInk", "--color-ink"],
  ["colorInkDeep", "--color-ink-deep"],
  ["colorCard", "--color-card"],
  ["colorPaper", "--color-paper"],
  ["colorOnDark", "--color-on-dark"],
  ["colorOnDarkMuted", "--color-on-dark-muted"],
  ["colorMutedLight", "--color-muted-light"],
  ["colorLineDark", "--color-line-dark"],
  ["colorLineLight", "--color-line-light"],
];

/**
 * CSS custom-property overrides built from the admin "Design" page. Every value is validated again here
 * (hex colors, known font keys, number ranges, safe image path) so nothing else can reach the stylesheet.
 * Only values that differ from the built-in defaults are written.
 */
export function designCss(get: (key: string) => string): string {
  const out: string[] = [];
  for (const [key, cssVar] of COLORS) {
    const v = get(key);
    if (HEX.test(v)) out.push(`${cssVar}:${v}`);
  }
  const fonts: [string, "display" | "accent" | "mono", string][] = [
    ["fontDisplay", "display", "--font-display"],
    ["fontAccent", "accent", "--font-accent"],
    ["fontMono", "mono", "--font-mono"],
  ];
  for (const [key, group, cssVar] of fonts) {
    const f = fontChoices[group].find((x) => x.key === get(key));
    if (f) out.push(`${cssVar}:var(${f.var}),${f.fallback}`);
    if (f && cssVar === "--font-display") out.push(`--font-body:var(${f.var}),"Helvetica Neue",Arial,sans-serif`);
  }
  const num = (key: string, min: number, max: number) => {
    const n = Number(get(key));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const body = num("numBodySize", 14, 22);
  if (body) out.push(`--fs-body:${body}px`);
  const width = num("numDisplayWidth", 62, 125);
  if (width) out.push(`--display-stretch:${width}%`);
  const box = num("numContainer", 1000, 1600);
  if (box) out.push(`--container:${box}px`);
  const logo = imageSrc(get("logoImage")) || "";
  if (/^(\/images\/|\/api\/media\/|https?:\/\/[^\s"'()\\]+\/api\/media\/)[a-zA-Z0-9._\-\/:]+$/.test(logo))
    out.push(`--logo-on-dark:url("${logo}")`);
  return out.length ? `html:root{${out.join(";")}}` : "";
}
