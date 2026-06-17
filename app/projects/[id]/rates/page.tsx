import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
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
    <main className="wrap">
      <SiteHeader action={<Link href={`/projects/${id}`} className="btn">Back to bid</Link>} />
      <div className="page-head">
        <h1 className="page-title">Rates</h1>
      </div>
      <p className="detail-meta">{project.name} · {project.finishes.length} in-scope finishes</p>

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
              materialUnitCost: f.materialUnitCost,
              installRate: f.installRate,
              wastePct: f.wastePct,
              cartonSize: f.cartonSize,
              materialSource: f.materialSource,
            }))}
          />
        )}
      </section>
    </main>
  );
}
