export type Redirect = { from: string; to: string; status: 301 | 302 | 307 | 308 };

/**
 * Parses the admin's redirect list. One rule per line:
 *   /old-page -> /new-page
 *   /old-page -> https://example.com/page   302
 * Lines starting with # are comments. The status defaults to 301 (permanent).
 * Invalid or looping rules are ignored.
 */
export function parseRedirects(text: string): Redirect[] {
  const out: Redirect[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(\S+)\s*(?:->|=>|→)\s*(\S+)(?:\s+(301|302|307|308))?$/.exec(line);
    if (!m) continue;
    const from = normalize(m[1]);
    const to = m[2];
    const okFrom = from.startsWith("/") && !from.startsWith("//");
    const okTo = (to.startsWith("/") && !to.startsWith("//")) || /^https:\/\/[^\s]+$/.test(to);
    if (!okFrom || !okTo || from === normalize(to)) continue;
    out.push({ from, to, status: (Number(m[3]) || 301) as Redirect["status"] });
  }
  return out;
}

/** Case-insensitive path without trailing slash (root stays "/"). */
export function normalize(path: string): string {
  const p = path.split(/[?#]/)[0].toLowerCase();
  return p.length > 1 ? p.replace(/\/+$/, "") : p || "/";
}
