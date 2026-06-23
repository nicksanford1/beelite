import Link from "next/link";

// Project workspace frame. The Overview is the hub — it shows the pipeline rail. Each stage page
// (Plans / Finishes / Rates / Takeoff) opens FOCUSED: full width, no rail, with one clear back
// affordance to the Overview. Route-driven, so navigating into a stage naturally maximizes it.
export function WorkspaceFrame({
  rail,
  children,
  focused = false,
  backHref,
  backLabel = "Overview",
  backSub,
}: {
  rail?: React.ReactNode;
  children: React.ReactNode;
  focused?: boolean;
  backHref?: string;
  backLabel?: string;
  backSub?: string;
}) {
  if (focused) {
    return (
      <main className="ws-focus">
        {backHref && (
          <Link href={backHref} className="ws-backbar">
            <span className="ws-backbar-arrow" aria-hidden>
              ‹
            </span>
            <span className="ws-backbar-text">{backLabel}</span>
            {backSub && <span className="ws-backbar-sub">{backSub}</span>}
          </Link>
        )}
        {children}
      </main>
    );
  }
  return (
    <div className="ws">
      <aside className="ws-rail">{rail}</aside>
      <main className="ws-main">{children}</main>
    </div>
  );
}
