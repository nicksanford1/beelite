import { NextRequest, NextResponse } from "next/server";
import { syncBidToSheet } from "@/app/actions";

// Background Sheet build, so "Create estimate" can redirect instantly. The Overview's SheetSyncRunner
// fires this once when a project still has no sheet. syncBidToSheet is idempotent + never throws.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project");
  if (!projectId) return NextResponse.json({ ok: false, error: "missing project" }, { status: 400 });
  const res = await syncBidToSheet(projectId);
  return NextResponse.json(res);
}
