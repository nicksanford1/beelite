import Link from "next/link";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readPageArtifact } from "@/lib/ingest";
import { DashSidebar } from "@/components/dash-sidebar";

// The Plan library: ingested reference plan sets (Project.status="corpus"), browsable by use-type.
// Cards open the existing per-project plans viewer (/projects/[id]/plans), which already stitches a
// multi-file set into one continuous page set — so the viewer comes for free.

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  multifamily: "Multifamily",
  hotel: "Hotel",
  healthcare: "Healthcare",
  "office-ti": "Office TI",
  retail: "Retail",
  institutional: "Institutional",
  industrial: "Industrial",
  restaurant: "Restaurant",
  other: "Other",
};
const label = (t: string | null) => (t ? TYPE_LABEL[t] ?? t : "Untagged");

export default async function PlanLibraryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const active = (type ?? "").trim();

  const facets = await db.project.groupBy({
    by: ["projectType"],
    where: { status: "corpus" },
    _count: true,
    orderBy: { _count: { projectType: "desc" } },
  });
  const total = facets.reduce((n, f) => n + f._count, 0);

  const projects = await db.project.findMany({
    where: { status: "corpus", ...(active ? { projectType: active } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { pages: true } }, pages: { orderBy: { pageNumber: "asc" }, take: 1 } },
      },
    },
  });

  const cards = await Promise.all(
    projects.map(async (p) => {
      const pages = p.documents.reduce((n, d) => n + d._count.pages, 0);
      const firstPage = p.documents[0]?.pages[0];
      const thumbPath = firstPage ? readPageArtifact(firstPage.scanSignals)?.imagePath : null;
      const thumbUrl = thumbPath ? await signedUrl(thumbPath, 3600).catch(() => null) : null;
      return { id: p.id, name: p.name, type: p.projectType, location: p.location, pages, files: p.documents.length, thumbUrl };
    })
  );

  return (
    <div className="dash">
      <DashSidebar active="plan-library" />
      <main className="dash-main">
        <div className="dash-top">
          <div>
            <h1>Plan library</h1>
            <p className="dash-sub">Reference plan sets, ingested once and browsable by type.</p>
          </div>
        </div>

        {/* Type facets */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <Link className={`btn${active ? "" : " btn-primary"}`} href="/plan-library">All <span className="mono">{total}</span></Link>
          {facets.map((f) => (
            <Link
              key={f.projectType ?? "untagged"}
              className={`btn${active === f.projectType ? " btn-primary" : ""}`}
              href={`/plan-library?type=${encodeURIComponent(f.projectType ?? "")}`}
            >
              {label(f.projectType)} <span className="mono">{f._count}</span>
            </Link>
          ))}
        </div>

        {cards.length === 0 ? (
          <div className="empty">
            <h2>No plan sets yet</h2>
            <p>Ingested permit plan sets show up here, grouped by building type.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {cards.map((c) => (
              <Link
                key={c.id}
                href={`/projects/${c.id}/plans`}
                style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface, rgba(255,255,255,.02))", textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}
              >
                <div style={{ aspectRatio: "4 / 3", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {c.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>processing…</span>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="dash-chip">{label(c.type)}</span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{c.pages} pp{c.files > 1 ? ` · ${c.files} files` : ""}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</div>
                  {c.location && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.location}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
