import { db } from "@/lib/db";
import type { PageRoles } from "@/lib/anthropic";

// Overview = a derived status page. NO AI call — everything here comes from rows already saved
// during upload, ingest, the guarded finish read, and confirm. State is derived from row-presence
// + the saved Extraction.rawOutput.status, never from stored workflow flags (nothing to keep in sync).

export type FinishReadStatus = "not_started" | "processing" | "found" | "possible" | "not_found" | "error";
export type StepState = "pending" | "started" | "needs_review" | "complete" | "blocked";

export type NextAction = {
  key: string;
  label: string;
  buttonText: string;
  href?: string; // omitted when the action is the Read-Finishes button (a server action, not a link)
};

export type ProjectOverview = {
  project: {
    id: string;
    name: string;
    gc: string | null;
    location: string | null;
    projectType: string | null;
    architect: string | null;
    owner: string | null;
    squareFeet: string | null;
    projectNumber: string | null;
    issueDate: string | null;
    estimator: string | null;
    bidDate: Date | null;
    notes: string | null;
    updatedAt: Date;
  };
  document: {
    id: string;
    originalFilename: string | null;
    pageCount: number;
    uploadedAt: Date;
  } | null;
  aiFindings: {
    projectDetailsStatus: "found" | "partial" | "missing";
    finishReadStatus: FinishReadStatus;
    finishReadConfidence: number | null;
    finishReadReason: string | null;
    evidencePages: string[]; // sheet labels (e.g. "A2.4"), not page indexes — kept honest as text
    pageRoles: PageRoles | null; // honest page-role observations from the read (null until read runs)
    finishesFound: number; // from the read result
    confirmedFinishes: number; // confirmed ProjectFinish rows
  };
  workflow: {
    currentStatus: string;
    steps: {
      plans: StepState;
      finishes: StepState;
      takeoff: StepState;
      rates: StepState;
      scope: StepState;
      sheetSync: StepState;
      bid: StepState;
    };
    nextAction: NextAction;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRaw(raw: any): {
  status: FinishReadStatus;
  confidence: number | null;
  reason: string | null;
  evidence: string[];
  pageRoles: PageRoles | null;
  count: number;
} {
  if (!raw || typeof raw !== "object") {
    return { status: "not_started", confidence: null, reason: null, evidence: [], pageRoles: null, count: 0 };
  }
  const count = Array.isArray(raw.finishes) ? raw.finishes.length : 0;
  // Whole-doc guarded read stores an explicit status (incl. processing/error); the older per-page
  // read stores only finishes.
  const known = ["processing", "found", "possible", "not_found", "error"];
  const status: FinishReadStatus = known.includes(raw.status) ? raw.status : count > 0 ? "found" : "not_found";
  return {
    status,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    reason: typeof raw.reason === "string" && raw.reason ? raw.reason : null,
    evidence: Array.isArray(raw.evidencePages) ? raw.evidencePages.map(String) : [],
    pageRoles: raw.pageRoles && typeof raw.pageRoles === "object" ? (raw.pageRoles as PageRoles) : null,
    count,
  };
}

export async function getProjectOverview(projectId: string): Promise<ProjectOverview | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        include: { pages: { orderBy: { pageNumber: "asc" }, include: { extraction: true } } },
      },
      finishes: true,
      takeoff: true,
      scopeItems: true,
    },
  });
  if (!project) return null;

  const doc = project.documents[0] ?? null;
  const pages = project.documents.flatMap((d) => d.pages);
  const extraction = pages.find((p) => p.extraction)?.extraction ?? null;
  const read = readRaw(extraction?.rawOutput);

  // ── AI findings ──────────────────────────────────────────────
  const hasName = !!project.name;
  const hasMeta = !!(project.location || project.architect || project.owner || project.squareFeet || project.projectNumber);
  const projectDetailsStatus = !hasName ? "missing" : hasMeta ? "found" : "partial";
  const finishReadStatus: FinishReadStatus = extraction ? read.status : "not_started";

  // ── workflow counts ──────────────────────────────────────────
  const confirmedFinishes = project.finishes.length;
  const inScope = project.finishes.filter((f) => f.inScope);
  const needsRate = inScope.filter(
    (f) => (f.materialSource !== "owner_furnishes" && f.materialUnitCost <= 0) || f.installRate <= 0
  ).length;
  const takeoffRows = project.takeoff.length;
  const approved = project.takeoff.filter((t) => t.status === "approved").length;
  const scopeCount = project.scopeItems.length;
  const synced = !!project.sheetId;
  const passed = project.status === "passed";
  const hasPlans = project.documents.length > 0;

  const steps = {
    plans: (hasPlans ? "complete" : "pending") as StepState,
    finishes: (confirmedFinishes > 0
      ? "complete"
      : finishReadStatus === "processing"
        ? "started"
        : finishReadStatus === "not_found"
          ? "blocked"
          : finishReadStatus === "found" || finishReadStatus === "possible"
            ? "needs_review"
            : "pending") as StepState,
    takeoff: (approved > 0 ? "complete" : takeoffRows > 0 ? "started" : "pending") as StepState,
    rates: (inScope.length > 0 && needsRate === 0 ? "complete" : "pending") as StepState,
    scope: (scopeCount > 0 ? "complete" : "pending") as StepState,
    sheetSync: (synced ? "complete" : "pending") as StepState,
    bid: (passed ? "blocked" : "pending") as StepState,
  };

  // ── current status + the single next action ──────────────────
  const fin = `/projects/${projectId}/finishes`;
  let currentStatus: string;
  let nextAction: NextAction;

  if (passed) {
    currentStatus = "passed";
    nextAction = { key: "passed", label: "This bid was marked not-a-fit.", buttonText: "Open finishes", href: fin };
  } else if (!hasPlans) {
    currentStatus = "no_plans";
    nextAction = { key: "upload", label: "Upload the plan set to begin.", buttonText: "Upload plans", href: `/projects/${projectId}/plans` };
  } else if (finishReadStatus === "processing") {
    currentStatus = "finish_read_processing";
    nextAction = { key: "processing", label: "Reading the plan set for finishes…", buttonText: "Refresh", href: `/projects/${projectId}` };
  } else if (confirmedFinishes === 0 && finishReadStatus === "error") {
    currentStatus = "finish_read_error";
    nextAction = { key: "read_finishes", label: "The finish read failed — try again.", buttonText: "Re-read Finishes" };
  } else if (finishReadStatus === "not_started") {
    currentStatus = "plans_uploaded";
    nextAction = { key: "read_finishes", label: "Read the finish schedule from the plan set.", buttonText: "Read Finishes" };
  } else if (confirmedFinishes === 0 && finishReadStatus === "not_found") {
    currentStatus = "no_finish_schedule_found";
    nextAction = { key: "no_schedule", label: "No flooring finish schedule found — add finishes manually or pass.", buttonText: "Review options", href: fin };
  } else if (confirmedFinishes === 0 && finishReadStatus === "possible") {
    currentStatus = "ambiguous_finish_info";
    nextAction = { key: "review_finishes", label: "Possible finish info found — review the candidate pages.", buttonText: "Review Finishes", href: fin };
  } else if (confirmedFinishes === 0 && finishReadStatus === "found") {
    currentStatus = "finishes_found";
    nextAction = { key: "review_finishes", label: "Finishes read — review and confirm them.", buttonText: "Review Finishes", href: fin };
  } else if (confirmedFinishes > 0 && takeoffRows === 0) {
    currentStatus = "finishes_confirmed";
    nextAction = { key: "enter_takeoff", label: "Enter takeoff quantities for each finish.", buttonText: "Enter Takeoff", href: `/projects/${projectId}/takeoff` };
  } else if (takeoffRows > 0 && needsRate > 0) {
    currentStatus = "rates_needed";
    nextAction = { key: "confirm_rates", label: `${needsRate} finish${needsRate === 1 ? "" : "es"} still need a rate.`, buttonText: "Confirm Rates", href: `/projects/${projectId}/rates` };
  } else if (!synced) {
    currentStatus = "ready_to_sync";
    nextAction = { key: "sync", label: "Review scope and sync the bid to Google Sheets.", buttonText: "Open Estimate", href: `/projects/${projectId}/estimate` };
  } else {
    currentStatus = "synced";
    nextAction = { key: "review_bid", label: "Synced to Google Sheets — review and submit.", buttonText: "Open Estimate", href: `/projects/${projectId}/estimate` };
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      gc: project.gc,
      location: project.location,
      projectType: project.projectType,
      architect: project.architect,
      owner: project.owner,
      squareFeet: project.squareFeet,
      projectNumber: project.projectNumber,
      issueDate: project.issueDate,
      estimator: project.estimator,
      bidDate: project.bidDate,
      notes: project.notes,
      updatedAt: project.updatedAt,
    },
    document: doc
      ? { id: doc.id, originalFilename: doc.originalFilename, pageCount: doc.pages.length, uploadedAt: doc.createdAt }
      : null,
    aiFindings: {
      projectDetailsStatus,
      finishReadStatus,
      finishReadConfidence: extraction ? read.confidence : null,
      finishReadReason: extraction ? read.reason : null,
      evidencePages: extraction ? read.evidence : [],
      pageRoles: extraction ? read.pageRoles : null,
      finishesFound: extraction ? read.count : 0,
      confirmedFinishes,
    },
    workflow: { currentStatus, steps, nextAction },
  };
}
