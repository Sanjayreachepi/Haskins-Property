/** Full-screen branded loader: spinning badge, logo, hazard-stripe progress bar. Styles: app/motion.css (.ld*). */
export default function Loader({ label = "Loading administration" }: { label?: string }) {
  return (
    <div className="ld" role="status" aria-live="polite">
      <div className="ld-grid" aria-hidden="true" />
      <div className="ld-core">
        <div className="ld-badge" aria-hidden="true">
          <svg viewBox="0 0 200 200" className="ld-ring">
            <defs>
              <path id="ldcircle" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
            </defs>
            <circle cx="100" cy="100" r="98" fill="#121211" stroke="#f2a900" strokeWidth="1.5" />
            <text fill="#ffffff" className="ld-ring-text">
              <textPath href="#ldcircle" textLength="470" lengthAdjust="spacing">
                FAMILY OWNED · SOUTH SAN FRANCISCO · ROOTED HERE ·{" "}
              </textPath>
            </text>
          </svg>
          <svg viewBox="0 0 200 200" className="ld-arrow">
            <path
              d="M82 118 L118 82 M92 82 H118 V108"
              fill="none"
              stroke="#f2a900"
              strokeWidth="6"
              strokeLinecap="square"
            />
          </svg>
          <span className="ld-pulse" />
        </div>
        <img
          className="ld-logo"
          src="/images/logo-light.svg"
          alt="Haskins Industrial Complex"
          width="190"
          height="82"
        />
        <div className="ld-bar" aria-hidden="true">
          <span />
        </div>
        <p className="ld-label">
          {label}
          <b>.</b>
          <b>.</b>
          <b>.</b>
        </p>
      </div>
    </div>
  );
}
