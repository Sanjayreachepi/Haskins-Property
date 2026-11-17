"use client";
import { blockType, fontChoices, numberRanges, pageBlocks, type PageBlock } from "@haskins/shared";

const BUILTIN = [
  "69-s-linden-ave-main-office", "69-s-linden-ave-main-office-warehouse", "103-s-linden-ave-parking-entrance",
  "103-s-linden-ave-parking-entrance-2", "110-s-maple-ave-office-warehouse", "114-s-maple-ave-office",
  "114-s-maple-ave-warehouse", "114-s-maple-ave-warehouse-2", "114-s-maple-ave-yard", "120-s-maple-ave-office",
  "120-s-maple-ave-office-2", "400-450-e-jamie-ct-aerial", "400-450-e-jamie-ct-bayview", "400-450-e-jamie-ct-front",
  "400-450-e-jamie-ct-front-lobby", "a001-color", "a004-bw", "arthur-buzz-haskins-operating-engineers-board-meeting",
  "buzz_haskins_yard_monitor_bg_1920_1080", "buzz_on_scraper_114_cropped", "haskins-way-and-e-jamie-ct-aerial",
  "scrapers_1b", "scrapers_2b", "scrapers_3b", "scrapers_4b", "scrapers_5b",
].map((n) => "/images/" + n + ".webp");
const BUILTIN_ALL = [...BUILTIN, "/images/logo.png", "/images/logo-light.webp", "/images/logo-light.svg"];

type Media = { id: number; filename: string; original_name: string; mime: string };

export default function BlockEditor({
  slug,
  blocks,
  media,
  onChange,
}: {
  slug: string;
  blocks: Record<string, string> | undefined;
  media: Media[];
  onChange: (next: Record<string, string>) => void;
}) {
  const list = pageBlocks[slug] || [];
  const stored = blocks || {};
  const set = (k: string, v: string) => onChange({ ...stored, [k]: v });
  const reset = (k: string) => {
    const n = { ...stored };
    delete n[k];
    onChange(n);
  };
  const groups: Record<string, PageBlock[]> = {};
  for (const b of list) (groups[b.group || "Text"] ||= []).push(b);
  const uploaded = media.filter((m) => m.mime.startsWith("image/")).map((m) => ({ url: "/api/media/" + m.filename, name: m.original_name }));

  function control(b: PageBlock, value: string) {
    const type = blockType(b.key, b.type);
    if (type === "color")
      return (
        <span className="block-color">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => set(b.key, e.target.value)} />
          <input value={value} maxLength={7} onChange={(e) => set(b.key, e.target.value)} />
        </span>
      );
    if (type === "font") {
      const opts = fontChoices[b.key === "fontDisplay" ? "display" : b.key === "fontAccent" ? "accent" : "mono"];
      return (
        <select value={value} onChange={(e) => set(b.key, e.target.value)}>
          {opts.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      );
    }
    if (type === "image") {
      const known = [...BUILTIN_ALL, ...uploaded.map((u) => u.url)];
      return (
        <span className="block-image">
          {value && /\.(webp|png|svg|jpe?g)$/i.test(value) && (
            <img src={value.startsWith("/api/media/") ? value : value} alt="" style={{ maxHeight: 64, maxWidth: 120, objectFit: "contain", background: "#2b2a27" }} />
          )}
          <select value={value} onChange={(e) => set(b.key, e.target.value)}>
            {!known.includes(value) && <option value={value}>{value || "—"}</option>}
            <optgroup label="Site photos">
              {BUILTIN_ALL.map((u) => (
                <option key={u} value={u}>{u.replace("/images/", "")}</option>
              ))}
            </optgroup>
            {uploaded.length > 0 && (
              <optgroup label="Uploaded media library">
                {uploaded.map((u) => (
                  <option key={u.url} value={u.url}>{u.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </span>
      );
    }
    if (type === "number") {
      const r = numberRanges[b.key];
      return <input type="number" min={r?.[0]} max={r?.[1]} value={value} onChange={(e) => set(b.key, e.target.value)} />;
    }
    return b.multiline ? (
      <textarea rows={4} value={value} onChange={(e) => set(b.key, e.target.value)} />
    ) : (
      <input value={value} onChange={(e) => set(b.key, e.target.value)} />
    );
  }

  return (
    <>
      <p className="eyebrow">Every box shows the text currently on the site. Edit it, then save and publish. “Reset” returns one item to the standard value.</p>
      {Object.entries(groups).map(([group, items]) => (
        <details key={group} open={Object.keys(groups).length === 1} className="block-group">
          <summary className="eyebrow">{group}</summary>
          {items.map((b) => {
            const value = stored[b.key] ?? b.default;
            const changed = stored[b.key] !== undefined && stored[b.key] !== b.default;
            return (
              <label key={b.key}>
                {b.label}
                {control(b, value)}
                {changed && (
                  <button type="button" className="ghost" onClick={() => reset(b.key)}>Reset to standard</button>
                )}
              </label>
            );
          })}
        </details>
      ))}
    </>
  );
}
