import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readPageArtifact } from "@/lib/ingest";
import { readWholeDoc, uploadDocument } from "@/app/actions";
import { ProjectWorkspace } from "@/components/project-workspace";
import { PlansReview, type PlanPageView } from "@/components/plans-review";
import { UploadForm } from "@/components/upload-form";
import type { SheetLabel } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

export default async function PlansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await params;
  const { sheet: sheetParam } = await searchParams;
  const project = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) notFound();

  const doc = await db.document.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { pages: { orderBy: { pageNumber: "asc" }, include: { extraction: true } } },
  });
  const upload = uploadDocument.bind(null, id);

  if (!doc) {
    return (
      <ProjectWorkspace projectId={id} active="plans">
        <div className="page-head"><h1 className="page-title">Plans</h1></div>
        <p className="detail-meta">Upload the architectural set to begin.</p>
        <UploadForm action={upload} />
      </ProjectWorkspace>
    );
  }

  const pdfUrl = await signedUrl(doc.fileUrl).catch(() => null);
  const filename = doc.originalFilename ?? doc.fileUrl.split("/").pop() ?? "Plan PDF";

  // Sheet labels (number + title) + evidence come from the read's saved output (no AI on load).
  const ext = doc.pages.find((p) => p.extraction)?.extraction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (ext?.rawOutput ?? {}) as any;
  const finishStatus: string = raw.status ?? "";
  const byPage = new Map<number, SheetLabel>((Array.isArray(raw.sheetIndex) ? raw.sheetIndex : []).map((s: SheetLabel) => [s.page, s]));
  const evidence = new Set<string>(Array.isArray(raw.evidencePages) ? raw.evidencePages.map(String) : []);

  const pages: PlanPageView[] = await Promise.all(
    doc.pages.map(async (p) => {
      const art = readPageArtifact(p.scanSignals);
      const imageUrl = art?.imagePath ? await signedUrl(art.imagePath, 3600).catch(() => null) : null;
      const label = byPage.get(p.pageNumber);
      const sheet = label?.sheet || p.sheetNumber || "";
      return {
        pageNumber: p.pageNumber,
        imageUrl,
        sheet,
        title: label?.title || p.sheetTitle || "",
        isEvidence: !!(sheet && evidence.has(sheet)),
      };
    })
  );

  const processing = pages.length === 0;
  // Deep-link from the Finishes table: ?sheet=A6.1 opens the viewer on that sheet.
  const initialPage = sheetParam
    ? pages.find((p) => p.sheet && p.sheet.toLowerCase() === sheetParam.toLowerCase())?.pageNumber
    : undefined;

  return (
    <ProjectWorkspace projectId={id} active="plans">
      <div className="page-head">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="detail-meta" style={{ margin: "2px 0 0" }}>Review the uploaded set, then read finishes.</p>
        </div>
        <div className="pl-head-actions">
          {pdfUrl && <a className="btn" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>}
          <form action={readWholeDoc.bind(null, doc.id)}>
            <button type="submit" className="btn btn-primary">{finishStatus === "" || finishStatus === "not_started" ? "Read Finishes" : "Re-read Finishes"}</button>
          </form>
        </div>
      </div>

      <div className="pl-file">
        <span className="pl-file-icon" aria-hidden>▦</span>
        <div className="pl-file-main">
          <div className="pl-file-name">{filename}</div>
          <div className="pl-file-meta">
            {doc.pages.length ? `${doc.pages.length} pages` : "processing pages…"}
            {doc.createdAt ? ` · uploaded ${new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </div>
        </div>
      </div>

      {processing ? (
        <div className="card"><div className="card-main">
          <div className="card-title">Processing pages…</div>
          <div className="card-meta">Rendering each page so you can preview the set. Refresh in a moment.</div>
        </div></div>
      ) : (
        <PlansReview pages={pages} initialPage={initialPage} />
      )}

      <details className="pl-more">
        <summary>Upload a different plan</summary>
        <div style={{ marginTop: 12 }}><UploadForm action={upload} /></div>
      </details>
    </ProjectWorkspace>
  );
}
