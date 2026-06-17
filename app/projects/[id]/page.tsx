import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { SiteHeader } from "@/components/site-header";
import { uploadDocument } from "@/app/actions";

export const dynamic = "force-dynamic";

function bidDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "no date";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { documents: { include: { pages: true }, orderBy: { id: "desc" } } },
  });
  if (!project) notFound();

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
      <SiteHeader action={<Link href="/" className="btn">← All bids</Link>} />

      <div className="section-label">
        <span className="eyebrow">Bid</span>
        <span className="status" data-s={project.status}>{project.status}</span>
      </div>
      <h1 className="bid-name" style={{ fontSize: 28 }}>{project.name}</h1>
      <p className="bid-meta">
        {project.gc ?? "GC —"}
        <span className="sep">|</span>
        {project.location ?? "location —"}
        <span className="sep">|</span>
        BID {bidDate(project.bidDate)}
      </p>

      <div className="dimline" />

      <div className="section-label">
        <span className="eyebrow">Plans</span>
        <span className="count">{String(docs.length).padStart(2, "0")} uploaded</span>
      </div>

      {docs.length > 0 && (
        <div className="ledger" style={{ marginBottom: 20 }}>
          {docs.map((d) => (
            <div key={d.id} className="bid">
              <div className="bid-main">
                <div className="bid-name" style={{ fontSize: 15 }}>{d.filename}</div>
                <div className="bid-meta">
                  {d.pages.length
                    ? `${d.pages.length} page${d.pages.length > 1 ? "s" : ""} tagged`
                    : "not tagged yet"}
                </div>
              </div>
              {d.url && (
                <a className="status" href={d.url} target="_blank" rel="noreferrer">
                  open
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <form action={upload} className="form">
        <div className="field">
          <label htmlFor="file">Upload a plan (PDF)</label>
          <input id="file" name="file" type="file" accept="application/pdf" required />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Upload plan</button>
        </div>
      </form>

      <div className="dimline" />
      <p className="eyebrow">Next: tag the finish-schedule page, then read finishes with AI.</p>
    </main>
  );
}
