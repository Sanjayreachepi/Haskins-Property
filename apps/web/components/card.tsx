import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type CardProps = {
  href: string;
  /** Ready-to-use image src (see imageSrc in lib/content). `null` shows the "H" placeholder. */
  image?: string | null;
  imageAlt: string;
  /** Small label on the photo, top-left. */
  tag?: string;
  /** Big number on the photo, bottom-right ("01"). */
  index?: string;
  /** Small amber line above the title. */
  eyebrow?: string;
  title: string;
  /** Short paragraph under the title. */
  description?: string;
  /** Amber note under the title (e.g. "Land interest only"). */
  note?: string;
  /** Content of the bottom row, next to the arrow. */
  footer?: ReactNode;
  /** Position in the grid — staggers the entrance animation. */
  order?: number;
};

/**
 * The one card used sitewide. Styles live in app/ui.css (`.ui-card*`) and come
 * from the theme tokens, so a change there updates every card.
 * Put cards inside <div className="ui-cards">.
 */
export default function Card({
  href,
  image,
  imageAlt,
  tag,
  index,
  eyebrow,
  title,
  description,
  note,
  footer,
  order = 0,
}: CardProps) {
  return (
    <Link
      className="ui-card"
      href={href}
      style={{ "--i": order } as CSSProperties}
    >
      <div className="ui-card-media">
        {image === null ? (
          <div className="ui-card-placeholder" aria-hidden="true">
            H
          </div>
        ) : image ? (
          <img
            className="ui-card-img"
            src={image}
            alt={imageAlt}
            loading="lazy"
          />
        ) : null}
        {tag && <span className="ui-card-tag">{tag}</span>}
        {index && (
          <span className="ui-card-idx" aria-hidden="true">
            {index}
          </span>
        )}
      </div>
      <div className="ui-card-body">
        {eyebrow && <span className="ui-card-eyebrow">{eyebrow}</span>}
        <h3 className="ui-card-title">{title}</h3>
        {description && <p className="ui-card-text">{description}</p>}
        {note && <span className="ui-card-note">{note}</span>}
        <div className="ui-card-foot">
          <span>{footer}</span>
          <span className="ui-card-arrow" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="square"
            >
              <path d="M6 18 18 6M8 6h10v10" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
