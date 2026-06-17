import Link from "next/link";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

function bidDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "no date";
}

export default async function Home() {
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="wrap">
      <SiteHeader
        action={
          <Link href="/projects/new" className="btn btn-primary">
            + New bid
          </Link>
        }
      />

      {projects.length === 0 ? (
        <div className="empty">
          <h2>No bids yet.</h2>
          <p>Start your first takeoff — upload plans, read the finishes, build the bid.</p>
          <Link href="/projects/new" className="btn btn-primary">
            + New bid
          </Link>
        </div>
      ) : (
        <>
          <div className="section-label">
            <span className="eyebrow">Bids</span>
            <span className="count">{String(projects.length).padStart(2, "0")} active</span>
          </div>

          <div className="ledger">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="bid">
                <div className="bid-main">
                  <div className="bid-name">{p.name}</div>
                  <div className="bid-meta">
                    {p.gc ?? "GC —"}
                    <span className="sep">|</span>
                    {p.location ?? "location —"}
                    <span className="sep">|</span>
                    BID {bidDate(p.bidDate)}
                  </div>
                </div>
                <span className="status" data-s={p.status}>
                  {p.status}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
