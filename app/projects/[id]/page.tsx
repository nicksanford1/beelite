import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { uploadDocument } from "@/app/actions";
import { computeBid, usd } from "@/lib/estimate";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "No date set";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      documents: { include: { pages: true }, orderBy: { id: "desc" } },
      finishes: true,
      takeoff: true,
      settings: true,
    },
  });
  if (!project) notFound();

  const hasPlan = project.documents.length > 0;
  const finishCount = project.finishes.length;
  const hasTakeoff = project.takeoff.length > 0;
  const bid = computeBid(project.finishes, project.takeoff, project.settings);

  const upload = uploadDocument.bind(null, project.id);
  const docs = await Promise.all(
    project.documents.map(async (d) => ({
      ...d,
      url: await signedUrl(d.fileUrl).catch(() => null),
      filename: d.fileUrl.split("/").pop() ?? d.fileUrl,
    }))
  );

  return (
    <main className="wrap">
      <SiteHeader action={<Link href="/" className="btn">All bids</Link>} />

      <span className="badge" data-s={project.status}>{project.status}</span>
      <h1 className="detail-title">{project.name}</h1>
      <p className="detail-meta">
        {project.gc ?? "No GC"}
        <span className="dot"> · </span>
        {project.location ?? "No location"}
        <span className="dot"> · </span>
        Bid due {fmtDate(project.bidDate)}
      </p>

      <section className="section">
        <h2 className="section-title">Plans {docs.length > 0 && `(${docs.length})`}</h2>

        {docs.length > 0 && (
          <div className="list" style={{ marginBottom: 20 }}>
            {docs.map((d) => {
              const suggested = d.pages.filter((p) => p.suggestedSheetType === "finish_schedule").length;
              const confirmed = d.pages.filter((p) => p.sheetType === "finish_schedule").length;
              return (
              <div key={d.id} className="card">
                <div className="card-main">
                  <div className="card-title">{d.filename}</div>
                  <div className="card-meta">
                    {d.pages.length ? `${d.pages.length} pages` : "scanning…"}
                    {confirmed > 0
                      ? ` · ${confirmed} tagged finish schedule`
                      : suggested > 0
                        ? ` · ${suggested} look like finish schedules`
                        : ""}
                  </div>
                </div>
                <Link className="btn" href={`/projects/${id}/pages?doc=${d.id}`}>Pages</Link>
                {d.url && (
                  <a className="btn" href={d.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
              </div>
              );
            })}
          </div>
        )}

        <form action={upload} className="form">
          <div className="field">
            <label htmlFor="file">Upload a plan (PDF)</label>
            <input id="file" name="file" type="file" accept="application/pdf" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Upload plan
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2 className="section-title">Finishes {finishCount > 0 && `(${finishCount})`}</h2>
        {finishCount > 0 ? (
          <div className="card">
            <div className="card-main">
              <div className="card-title">{finishCount} finishes confirmed</div>
              <div className="card-meta">
                {project.finishes.filter((f) => f.inScope).length} in scope · ready for rates &amp; takeoff
              </div>
            </div>
            <Link href={`/projects/${id}/finishes`} className="btn">Review</Link>
          </div>
        ) : hasPlan ? (
          <div className="card">
            <div className="card-main">
              <div className="card-title">Read the finish schedule</div>
              <div className="card-meta">Let Claude pull the finish codes off your plan.</div>
            </div>
            <Link href={`/projects/${id}/finishes`} className="btn btn-primary">Read with AI</Link>
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            Upload a plan above, then read its finishes.
          </p>
        )}
      </section>

      {finishCount > 0 && (
        <section className="section">
          <h2 className="section-title">Bid</h2>
          <div className="card" style={{ alignItems: "baseline" }}>
            <div className="card-main">
              <div className="card-meta">Bid price {hasTakeoff ? "" : "(enter a takeoff to populate)"}</div>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                {usd(bid.bidPrice)}
              </div>
            </div>
            <Link href={`/projects/${id}/estimate`} className="btn btn-primary">Open bid</Link>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <Link href={`/projects/${id}/rates`} className="btn">Rates</Link>
            <Link href={`/projects/${id}/takeoff`} className="btn">Takeoff</Link>
            <Link href={`/projects/${id}/estimate`} className="btn">Bid preview</Link>
          </div>
        </section>
      )}
    </main>
  );
}
