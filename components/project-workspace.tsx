import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deriveWorkflow, type StageKey } from "@/lib/workflow";
import { usd } from "@/lib/estimate";
import { WorkspaceFrame } from "@/components/workspace-frame";

/**
 * Project workspace shell: a persistent left rail (the bid pipeline drawn as a measured rule, plus a
 * live bid readout) wrapping the active stage. Loads the project once and derives the workflow status
 * from the shared helper so the stepper and the bid never disagree.
 */
export async function ProjectWorkspace({
  projectId,
  active,
  children,
}: {
  projectId: string;
  active?: StageKey; // omitted on the Overview (it isn't a pipeline stage)
  children: React.ReactNode;
}) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      documents: { include: { pages: true } },
      finishes: true,
      takeoff: true,
      scopeItems: true,
      settings: true,
    },
  });
  if (!project) notFound();

  // Stage pages (Plans/Finishes/Rates/Takeoff) open focused — full width, no rail — with one clear
  // back affordance to the Overview hub. The Overview itself (no active stage) keeps the rail/steps.
  if (active !== undefined) {
    return (
      <WorkspaceFrame focused backHref={`/projects/${projectId}`} backLabel="Overview" backSub={project.name}>
        {children}
      </WorkspaceFrame>
    );
  }

  const { stages, bid } = deriveWorkflow(project);

  const rail = (
    <>
      <Link href="/" className="ws-back">← All bids</Link>
      <Link href={`/projects/${projectId}`} className="ws-proj">
        <div className="ws-proj-name">{project.name}</div>
        <div className="ws-proj-meta">
          {project.gc ?? "No GC"} · {project.location ?? "No location"}
        </div>
      </Link>

      <nav className="rule" aria-label="Bid pipeline">
        <Link
          href={`/projects/${projectId}`}
          className="rule-step rule-overview"
          data-state={active === undefined ? "active" : "todo"}
          aria-current={active === undefined ? "page" : undefined}
        >
          <span className="rule-tick">◆</span>
          <span>
            <span className="rule-label">Overview</span>
            <span className="rule-note">Status &amp; summary</span>
          </span>
        </Link>
        {stages.map((s) => (
          <Link
            key={s.key}
            href={`/projects/${projectId}${s.path}`}
            className="rule-step"
            data-state={s.state}
            aria-current={s.key === active ? "page" : undefined}
          >
            <span className="rule-tick">{s.state === "done" ? "✓" : s.n}</span>
            <span>
              <span className="rule-label">{s.label}</span>
              <span className="rule-note">{s.note}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="ws-readout">
        <div className="ws-readout-label">Bid price</div>
        <div className="ws-readout-figure">{usd(bid.bidPrice)}</div>
        {bid.profit > 0 && <div className="ws-readout-sub">profit {usd(bid.profit)}</div>}
      </div>
    </>
  );

  return <WorkspaceFrame rail={rail}>{children}</WorkspaceFrame>;
}
