import type { ReactNode } from "react";

/** Brand row + tagline + the dimension-line divider (the signature motif). */
export function SiteHeader({ action }: { action?: ReactNode }) {
  return (
    <header>
      <div className="topbar">
        <div>
          <div className="brand">
            <svg className="mark" viewBox="0 0 20 22" aria-hidden="true">
              <polygon
                points="10,1 19,6 19,16 10,21 1,16 1,6"
                fill="#db9514"
                stroke="#1a1916"
                strokeWidth="1"
              />
            </svg>
            <span className="wordmark">beelite</span>
          </div>
          <p className="tagline">Commercial flooring · takeoff &amp; estimating</p>
        </div>
        {action}
      </div>
      <div className="dimline" />
    </header>
  );
}
