"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultCompany } from "@/lib/company";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
};

export async function createProject(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return; // name is required; the form enforces it too

  const company = await getOrCreateDefaultCompany();
  const bidDateRaw = str(formData.get("bidDate"));

  await db.project.create({
    data: {
      companyId: company.id,
      name,
      gc: str(formData.get("gc")),
      location: str(formData.get("location")),
      bidDate: bidDateRaw ? new Date(bidDateRaw) : null,
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/");
  redirect("/");
}
