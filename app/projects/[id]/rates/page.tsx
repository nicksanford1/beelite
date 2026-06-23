import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProjectWorkspace } from "@/components/project-workspace";
import { RatesEditor } from "@/components/rates-editor";

export const dynamic = "force-dynamic";

export default async function RatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { finishes: { where: { inScope: true }, orderBy: { code: "asc" } } },
  });
  if (!project) notFound();

  return (
    <ProjectWorkspace projectId={id} active="rates">
      <div className="page-head">
        <h1 className="page-title">Rates</h1>
        <span className="page-count">{project.finishes.length} in scope</span>
      </div>
      <p className="detail-meta">
        Auto-filled from your standard rates — adjust per bid. Anything still missing a price is flagged.
      </p>

      <section className="section">
        {project.finishes.length === 0 ? (
          <div className="empty">
            <h2>No finishes yet</h2>
            <p>Read and confirm the finish schedule first.</p>
            <Link href={`/projects/${id}/finishes`} className="btn btn-primary">Go to finishes</Link>
          </div>
        ) : (
          <RatesEditor
            projectId={id}
            initial={project.finishes.map((f) => ({
              id: f.id,
              code: f.code,
              type: f.type,
              application: f.application,
              materialUnitCost: f.materialUnitCost,
              installRate: f.installRate,
              wastePct: f.wastePct,
              cartonSize: f.cartonSize,
              materialSource: f.materialSource,
            }))}
          />
        )}
      </section>
    </ProjectWorkspace>
  );
}
