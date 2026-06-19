"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const VALID = ["new", "saved", "downloaded", "dismissed"] as const;
type LeadStatus = (typeof VALID)[number];

// Triage a permit lead. Invoked from inline <form action={setLeadStatus}> buttons on /permits, so it
// reads the permit id + target status from FormData and re-renders the current view via revalidate.
export async function setLeadStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !VALID.includes(status as LeadStatus)) return;

  await db.nolaPermit.update({
    where: { id },
    data: { leadStatus: status, leadUpdatedAt: new Date() },
  });
  revalidatePath("/permits");
}

// Bulk triage: apply one status to many permits at once. Driven by the checkbox multi-select on
// /permits — the row checkboxes submit as repeated `ids`, the clicked button supplies `status`.
export async function setLeadStatusBulk(formData: FormData) {
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const status = String(formData.get("status") ?? "");
  if (!ids.length || !VALID.includes(status as LeadStatus)) return;

  await db.nolaPermit.updateMany({
    where: { id: { in: ids } },
    data: { leadStatus: status, leadUpdatedAt: new Date() },
  });
  revalidatePath("/permits");
}
