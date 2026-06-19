"use client";

// Header "select all" checkbox for the /permits bulk-triage table. Toggles every row checkbox that
// belongs to the external bulk form (form="bulkTriage"). Pure client-side; no state to persist.
export function PermitSelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all permits on this page"
      title="Select all on this page"
      onChange={(e) => {
        const checked = e.currentTarget.checked;
        document
          .querySelectorAll<HTMLInputElement>('input[name="ids"][form="bulkTriage"]')
          .forEach((cb) => {
            cb.checked = checked;
          });
      }}
    />
  );
}
