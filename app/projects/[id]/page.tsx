import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { uploadDocument } from "@/app/actions";
import { ProjectWorkspace } from "@/components/project-workspace";
import { UploadForm } from "@/components/upload-form";
import { PlansViewer } from "@/components/plans-viewer";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      documents: { include: { pages: { orderBy: { pageNumber: "asc" } } }, orderBy: { id: "desc" } },
    },
  });
  if (!project) notFound();

  const upload = uploadDocument.bind(null, project.id);
  // Newest document is shown inline (the common case = one plan set per bid).
  const doc = project.documents[0];
  const pdfUrl = doc ? await signedUrl(doc.fileUrl).catch(() => null) : null;
  const filename = doc ? doc.fileUrl.split("/").pop() ?? doc.fileUrl : null;

  return (
    <ProjectWorkspace projectId={id} active="plans">
      <div className="page-head">
        <h1 className="page-title">Plans</h1>
        {doc && doc.pages.length > 0 && <span className="page-count">{doc.pages.length} pages</span>}
      </div>

      {!doc ? (
        <>
          <p className="detail-meta">Upload the architectural set. We’ll read every page and flag the finish schedule.</p>
          <UploadForm action={upload} />
        </>
      ) : doc.pages.length === 0 ? (
        <>
          <p className="detail-meta">{filename}</p>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-main">
              <div className="card-title">Scanning pages…</div>
              <div className="card-meta">Reading the set to find the finish schedule. Refresh in a moment.</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <p className="detail-meta" style={{ margin: 0 }}>
              {filename} — scroll the set and tag the finish-schedule page, then read it.
            </p>
            {pdfUrl && (
              <a className="btn" href={pdfUrl} target="_blank" rel="noreferrer" style={{ padding: "6px 12px", fontSize: 13 }}>
                Open PDF
              </a>
            )}
          </div>
          <div style={{ marginTop: 18 }}>
            <PlansViewer
              projectId={id}
              documentId={doc.id}
              initial={doc.pages.map((p) => ({
                id: p.id,
                pageNumber: p.pageNumber,
                sheetNumber: p.sheetNumber,
                sheetTitle: p.sheetTitle,
                suggestedSheetType: p.suggestedSheetType,
                scanScore: p.scanScore,
                sheetType: p.sheetType,
              }))}
            />
          </div>

          <details style={{ marginTop: 28 }}>
            <summary className="card-meta" style={{ cursor: "pointer" }}>Upload a different plan</summary>
            <div style={{ marginTop: 12 }}>
              <UploadForm action={upload} />
            </div>
          </details>
        </>
      )}
    </ProjectWorkspace>
  );
}
