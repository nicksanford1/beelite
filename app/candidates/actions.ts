"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const VALID = ["new", "saved", "dismissed"] as const;
type Status = (typeof VALID)[number];

// Triage a candidate from the /candidates picker. Writes the same `leadStatus` the NOLA intake
// pipeline reads (saved → nola:docs scrapes plans → nola:intake imports as a Project), so confirming
// a project here needs no separate import step.
export async function setCandidateStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !VALID.includes(status as Status)) return;

  await db.nolaPermit.update({
    where: { id },
    data: { leadStatus: status, leadUpdatedAt: new Date() },
  });
  revalidatePath("/candidates");
}
