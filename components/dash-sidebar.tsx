import Link from "next/link";
import { getConnection } from "@/lib/google";

export async function DashSidebar({ active }: { active?: "bids" | "permits" | "rates" }) {
  const google = await getConnection();
  return (
    <aside className="dash-side">
      <div className="dash-brand">
        <div className="dash-brand-mark">B</div>
        <div>
          <div className="dash-brand-name">Beelite</div>
          <div className="dash-brand-sub">Flooring estimating</div>
        </div>
      </div>
      <nav className="dash-nav">
        <Link href="/" data-active={active === "bids"}>Bids</Link>
        <Link href="/permits" data-active={active === "permits"}>Permits</Link>
        <Link href="/library" data-active={active === "rates"}>Standard rates</Link>
      </nav>
      <div className="dash-side-foot">
        Google Sheets<br />
        {google?.refreshToken ? (
          <span style={{ color: "var(--green)" }}>Connected{google.email ? ` · ${google.email}` : ""}</span>
        ) : (
          <a href="/api/auth/google">Connect</a>
        )}
      </div>
    </aside>
  );
}
