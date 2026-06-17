import Link from "next/link";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { getConnection } from "@/lib/google";
import { DeleteBidButton } from "@/components/delete-bid-button";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "No date set";
}

export default async function Home() {
  const [projects, google] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "desc" } }),
    getConnection(),
  ]);

  return (
    <main className="wrap">
      <SiteHeader
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/library" className="btn">Standard rates</Link>
            <Link href="/projects/new" className="btn btn-primary">New bid</Link>
          </div>
        }
      />

      <div
        className="card"
        style={{ marginBottom: 24, padding: "12px 16px", fontSize: 14, alignItems: "center" }}
      >
        <div className="card-main">
          <span style={{ color: "var(--muted)" }}>Google Sheets: </span>
          {google?.refreshToken ? (
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>
              connected{google.email ? ` · ${google.email}` : ""}
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>not connected</span>
          )}
        </div>
        {google?.refreshToken ? (
          <a className="btn" href="/api/auth/google">Reconnect</a>
        ) : (
          <a className="btn btn-primary" href="/api/auth/google">Connect Google</a>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="empty">
          <h2>No bids yet</h2>
          <p>Start your first one — upload the plans, read the finishes, and build the bid.</p>
          <Link href="/projects/new" className="btn btn-primary">
            Create your first bid
          </Link>
        </div>
      ) : (
        <>
          <div className="page-head">
            <h1 className="page-title">Your bids</h1>
            <span className="page-count">{projects.length} total</span>
          </div>

          <div className="list">
            {projects.map((p) => (
              <div key={p.id} className="card">
                <Link href={`/projects/${p.id}`} className="card-main" style={{ color: "inherit" }}>
                  <div className="card-title">{p.name}</div>
                  <div className="card-meta">
                    {p.gc ?? "No GC"}
                    <span className="dot">·</span>
                    {p.location ?? "No location"}
                    <span className="dot">·</span>
                    Bid due {fmtDate(p.bidDate)}
                  </div>
                </Link>
                <span className="badge" data-s={p.status}>
                  {p.status}
                </span>
                <DeleteBidButton id={p.id} name={p.name} />
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
