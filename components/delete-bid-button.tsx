"use client";

import { useTransition } from "react";
import { deleteProject } from "@/app/actions";

export function DeleteBidButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn"
      disabled={pending}
      title="Delete bid"
      onClick={() => {
        if (confirm(`Delete "${name}"? This removes the bid and its plans — it can't be undone.`)) {
          start(() => deleteProject(id));
        }
      }}
      style={{ padding: "8px 12px", color: "var(--marking)", borderColor: "var(--border)" }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
