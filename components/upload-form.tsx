"use client";

import { useFormStatus } from "react-dom";

// Upload runs a server action that uploads the PDF AND scans every page (slow for big sets), so the
// form needs a clear pending state — otherwise a click looks like nothing happened.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Uploading & scanning…" : "Upload plan"}
    </button>
  );
}

function PendingNote() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <span className="hint" style={{ margin: 0, padding: 0, border: 0 }}>
      Reading every page to find the finish schedule — a large set (100+ pages) can take a minute. Don’t close this tab.
    </span>
  );
}

export function UploadForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action} className="form" style={{ marginTop: 8 }}>
      <div className="field">
        <label htmlFor="file">Upload a plan (PDF)</label>
        <input id="file" name="file" type="file" accept="application/pdf" required />
      </div>
      <div className="form-actions" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <SubmitButton />
        <PendingNote />
      </div>
    </form>
  );
}
