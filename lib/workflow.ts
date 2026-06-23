import { computeBid, type BidResult } from "./estimate";

// One status model the rail stepper AND the dashboard both read, so counts never drift (Codex IA #1).

export type StageState = "done" | "active" | "todo" | "blocked";
export type StageKey = "plans" | "finishes" | "rates" | "takeoff" | "scope" | "bid";

export type Stage = {
  key: StageKey;
  n: number;
  label: string;
  path: string; // appended to /projects/[id]
  state: StageState;
  note: string;
};

// Loosely typed — accepts a project with documents{pages}, finishes, takeoff, scopeItems, settings.
type WorkflowProject = {
  sheetId: string | null;
  documents: { pages: { sheetType: string }[] }[];
  finishes: { inScope: boolean; materialUnitCost: number; installRate: number; materialSource: string }[];
  takeoff: { status: string }[];
  scopeItems: { id: string }[];
  settings: Parameters<typeof computeBid>[2];
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function deriveWorkflow(project: WorkflowProject): { stages: Stage[]; bid: BidResult } {
  const pages = project.documents.flatMap((d) => d.pages);
  const hasPlan = project.documents.length > 0;
  const tagged = pages.filter((p) => p.sheetType === "finish_schedule").length;

  const finishes = project.finishes;
  const inScope = finishes.filter((f) => f.inScope);
  const needsRate = inScope.filter(
    (f) => (f.materialSource !== "owner_furnishes" && f.materialUnitCost <= 0) || f.installRate <= 0
  ).length;
  const approved = project.takeoff.filter((t) => t.status === "approved").length;
  const bid = computeBid(finishes as never, project.takeoff as never, project.settings);

  const defs = [
    {
      key: "plans" as const, label: "Plans", path: "/plans",
      complete: hasPlan && (tagged > 0 || finishes.length > 0), blocked: false,
      note: hasPlan ? `${plural(pages.length, "page")}${tagged ? ` · ${tagged} tagged` : ""}` : "Upload a plan",
    },
    {
      key: "finishes" as const, label: "Finishes", path: "/finishes",
      complete: finishes.length > 0, blocked: false,
      note: finishes.length ? `${finishes.length} read · ${inScope.length} in scope` : "Read the schedule",
    },
    {
      key: "rates" as const, label: "Rates", path: "/rates",
      complete: inScope.length > 0 && needsRate === 0, blocked: needsRate > 0,
      note: inScope.length === 0 ? "Confirm finishes first" : needsRate > 0 ? `${needsRate} need a rate` : "All priced",
    },
    {
      key: "takeoff" as const, label: "Takeoff", path: "/takeoff",
      complete: approved > 0, blocked: false,
      note: approved ? `${plural(approved, "approved line")}` : "Enter quantities",
    },
    {
      key: "bid" as const, label: "Bid", path: "/estimate",
      complete: !!project.sheetId, blocked: false,
      note: project.sheetId ? "Synced to Sheets" : approved > 0 ? "Ready to sync" : "—",
    },
  ];

  const firstIncomplete = defs.findIndex((d) => !d.complete);
  const stages: Stage[] = defs.map((d, i) => ({
    key: d.key,
    n: i + 1,
    label: d.label,
    path: d.path,
    note: d.note,
    state: d.blocked ? "blocked" : d.complete ? "done" : i === firstIncomplete ? "active" : "todo",
  }));

  return { stages, bid };
}
