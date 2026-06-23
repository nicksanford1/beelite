import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { readPageArtifact } from "@/lib/ingest";
import { readWholeDoc, uploadDocument } from "@/app/actions";
import { ProjectWorkspace } from "@/components/project-workspace";
import { PlansReview, type PlanPageView } from "@/components/plans-review";
import { PlansAutoRefresh } from "@/components/plans-auto-refresh";
import { UploadForm } from "@/components/upload-form";
import type { SheetLabel } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

export default async function PlansPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await params;
  const { sheet: sheetParam } = await searchParams;
  const project = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) notFound();

  // A project's plan set can span MULTIPLE Document rows: storage caps a single upload at 50MB, so a
  // large architectural set is split across PDFs (see the project note). We load every document and
  // stitch their pages into ONE continuous set so the Plans tab shows the whole thing.
  const docs = await db.document.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    include: { pages: { orderBy: { pageNumber: "asc" }, include: { extraction: true } } },
  });
  const upload = uploadDocument.bind(null, id);

  if (!docs.length) {
    return (
      <ProjectWorkspace projectId={id} active="plans">
        <div className="page-head"><h1 className="page-title">Plans</h1></div>
        <p className="detail-meta">Upload the architectural set to begin.</p>
        <UploadForm action={upload} />
      </ProjectWorkspace>
    );
  }

  const primary = docs[0]; // first-uploaded file: the "Open PDF" target + finish-read source
  const pdfUrl = await signedUrl(primary.fileUrl).catch(() => null);
  const totalPages = docs.reduce((n, d) => n + d.pages.length, 0);
  const filename =
    docs.length === 1
      ? primary.originalFilename ?? primary.fileUrl.split("/").pop() ?? "Plan PDF"
      : `Combined set · ${docs.length} files`;

  // finishStatus (for the Read button label) comes from the primary doc's saved read output.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finishStatus: string = ((primary.pages.find((p) => p.extraction)?.extraction?.rawOutput ?? {}) as any).status ?? "";

  // Stitch pages across all docs into a single 1..N sequence. Each doc restarts pageNumber at 1, so
  // we offset by the cumulative page count. Sheet labels/evidence come from each doc's own read output.
  const pageGroups = await Promise.all(
    docs.map(async (d, di) => {
      const offset = docs.slice(0, di).reduce((n, x) => n + x.pages.length, 0);
      const ext = d.pages.find((p) => p.extraction)?.extraction;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (ext?.rawOutput ?? {}) as any;
      const byPage = new Map<number, SheetLabel>((Array.isArray(raw.sheetIndex) ? raw.sheetIndex : []).map((s: SheetLabel) => [s.page, s]));
      const evidence = new Set<string>(Array.isArray(raw.evidencePages) ? raw.evidencePages.map(String) : []);
      return Promise.all(
        d.pages.map(async (p): Promise<PlanPageView> => {
          const art = readPageArtifact(p.scanSignals);
          const imageUrl = art?.imagePath ? await signedUrl(art.imagePath, 3600).catch(() => null) : null;
          const label = byPage.get(p.pageNumber);
          const sheet = label?.sheet || p.sheetNumber || "";
          return {
            id: p.id,
            pageNumber: offset + p.pageNumber,
            imageUrl,
            sheet,
            title: label?.title || p.sheetTitle || "",
            isEvidence: !!(sheet && evidence.has(sheet)),
          };
        })
      );
    })
  );
  const pages: PlanPageView[] = pageGroups.flat();

  const processing = pages.length === 0;
  // Only auto-refresh for a freshly uploaded set (pages still rendering in). Old projects don't poll.
  const recentlyUploaded = primary.createdAt ? Date.now() - new Date(primary.createdAt).getTime() < 10 * 60 * 1000 : false;
  // Deep-link from the Finishes table: ?sheet=A6.1 opens the viewer on that sheet.
  const initialPage = sheetParam
    ? pages.find((p) => p.sheet && p.sheet.toLowerCase() === sheetParam.toLowerCase())?.pageNumber
    : undefined;

  return (
    <ProjectWorkspace projectId={id} active="plans">
      {recentlyUploaded && <PlansAutoRefresh count={pages.length} />}
      <div className="page-head">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="detail-meta" style={{ margin: "2px 0 0" }}>Review the uploaded set, then read finishes.</p>
        </div>
        <div className="pl-head-actions">
          {pdfUrl && <a className="btn" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>}
          {/* Finish-read runs on the primary file only; multi-file finish-read isn't wired yet. */}
          <form action={readWholeDoc.bind(null, primary.id)}>
            <button type="submit" className="btn btn-primary">{finishStatus === "" || finishStatus === "not_started" ? "Read Finishes" : "Re-read Finishes"}</button>
          </form>
        </div>
      </div>

      <div className="pl-file">
        <span className="pl-file-icon" aria-hidden>▦</span>
        <div className="pl-file-main">
          <div className="pl-file-name">{filename}</div>
          <div className="pl-file-meta">
            {totalPages ? `${totalPages} pages` : "processing pages…"}
            {docs.length > 1 ? ` · ${docs.length} files` : ""}
            {primary.createdAt ? ` · uploaded ${new Date(primary.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
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
