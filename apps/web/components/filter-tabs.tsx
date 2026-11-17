"use client";

/**
 * Filter tabs + a short summary on the right ("Showing 3 of 8 properties").
 * Controlled: the parent owns `value`. The first option is treated as "show all"
 * by the parent. Styles: app/ui.css (`.ui-tab*`).
 */
export default function FilterTabs({
  options,
  value,
  onChange,
  summary,
  label = "Filter",
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  summary?: string;
  label?: string;
}) {
  return (
    <div className="ui-tabbar">
      <div role="group" aria-label={label} className="ui-tabs">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="ui-tab"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
      {summary && (
        <span className="ui-tabs-summary" aria-live="polite">
          {summary}
        </span>
      )}
    </div>
  );
}
