// Where a bid actually sits in the pipeline, derived from what exists in the DB (no fake states).
export type BidStatusKey = "no_plans" | "reading" | "pricing" | "synced" | "passed";
export type BidStatus = { key: BidStatusKey; label: string };

export function deriveBidStatus(p: {
  status: string;
  documentsCount: number;
  finishesCount: number; // confirmed ProjectFinish rows
  sheetId: string | null;
}): BidStatus {
  if (p.status === "passed") return { key: "passed", label: "Passed" };
  if (p.sheetId) return { key: "synced", label: "Synced" };
  if (p.documentsCount === 0) return { key: "no_plans", label: "No plans" };
  if (p.finishesCount > 0) return { key: "pricing", label: "Pricing" };
  return { key: "reading", label: "Needs review" }; // plans uploaded, finishes not confirmed yet
}
