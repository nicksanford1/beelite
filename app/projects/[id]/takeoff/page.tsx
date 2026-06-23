import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProjectWorkspace } from "@/components/project-workspace";
import { TakeoffEditor } from "@/components/takeoff-editor";

export const dynamic = "force-dynamic";

export default async function TakeoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      finishes: { where: { inScope: true }, orderBy: { code: "asc" } },
      takeoff: { orderBy: { id: "asc" } },
    },
  });
  if (!project) notFound();

  return (
    <ProjectWorkspace projectId={id} active="takeoff">
      <div className="page-head">
        <h1 className="page-title">Takeoff</h1>
      </div>
      <p className="detail-meta">Enter quantities per area; pick the finish from the dropdown. Approved lines feed the bid.</p>

      <section className="section">
        {project.finishes.length === 0 ? (
          <div className="empty">
            <h2>No finishes yet</h2>
            <p>Confirm the finish schedule first so you have finishes to take off.</p>
            <Link href={`/projects/${id}/finishes`} className="btn btn-primary">Go to finishes</Link>
          </div>
        ) : (
          <TakeoffEditor
            projectId={id}
            finishes={project.finishes.map((f) => ({ code: f.code, unit: f.unit, application: f.application }))}
            initial={project.takeoff.map((t) => ({
              sheet: t.sheet ?? "",
              area: t.area,
              finishCode: t.finishCode,
              qty: t.qty,
              unit: t.unit,
              status: t.status,
            }))}
          />
        )}
      </section>
    </ProjectWorkspace>
  );
}
