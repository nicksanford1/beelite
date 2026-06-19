"use client";

import { useState } from "react";

// "Copy for Claude" — gathers the checked leads on /permits and copies a ready-to-paste instruction
// so the user can hand them straight to Claude (who runs the /nola-plans skill on each). Reads the
// same checkboxes as the bulk-triage form (data-permit / data-addr carry what Claude needs).
export function CopyLeadsForClaude() {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="btn-mini copy"
      title="Copy the checked leads as a ready-to-paste instruction for Claude"
      onClick={() => {
        const checked = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="bulkTriage"]:checked'),
        );
        if (!checked.length) {
          alert("Tick one or more leads first, then click Copy for Claude.");
          return;
        }
        const lines = checked.map((cb) => {
          const num = cb.dataset.permit ?? "";
          const addr = cb.dataset.addr ?? "";
          return `- ${num}${addr ? ` — ${addr}` : ""}`;
        });
        const text =
          "Run /nola-plans for the NOLA permit lead(s) below: list each permit's portal documents, " +
          "download the ones I'd need for a flooring takeoff into data/nola/<permitNum>/, then tell me " +
          "what you found, what you downloaded and why, and flag anything missing.\n\n" +
          lines.join("\n");
        navigator.clipboard.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => alert("Copy failed — clipboard blocked by the browser."),
        );
      }}
    >
      {done ? "✓ Copied" : "📋 Copy for Claude"}
    </button>
  );
}
