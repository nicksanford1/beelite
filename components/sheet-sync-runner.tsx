"use client";

import { useEffect, useRef } from "react";

/**
 * Builds the bid's Google Sheet in the background so "Create estimate" redirects instantly. Fires once
 * per mount, only when the project has no sheet yet. /api/sync (syncBidToSheet) is idempotent and
 * best-effort, so a duplicate or missed fire is harmless — the estimate screen can always sync manually.
 */
export function SheetSyncRunner({ projectId, hasSheet }: { projectId: string; hasSheet: boolean }) {
  const fired = useRef(false);

  useEffect(() => {
    if (hasSheet || fired.current) return;
    fired.current = true;
    fetch(`/api/sync?project=${encodeURIComponent(projectId)}`).catch(() => {});
  }, [projectId, hasSheet]);

  return null;
}
