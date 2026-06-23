"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Drives the whole-doc finish read from the client (the Vercel-safe trigger). The read should be fully
 * automatic: it fires once per mount whenever the read hasn't reached a terminal result yet (no read,
 * still processing, or never started), then polls until the result lands — no manual "Read finishes".
 * runGuardedRead is DB-idempotent (it skips a doc that already has a completed result), so an extra or
 * duplicate fire is a harmless no-op. Terminal states (found / possible / not_found / error) do nothing.
 */
const TERMINAL = new Set(["found", "possible", "not_found", "error"]);

export function FinishReadRunner({ documentId, status }: { documentId: string; status: string }) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (TERMINAL.has(status)) return; // already read — nothing to do

    // A read costs a paid Opus call, so NEVER fire one while a read is already running ("processing") —
    // just poll for its result. Only kick a read off when none has started yet ("" / not_started). The
    // upload already fires the first read, so on landing we normally only poll. This is what stops the
    // credit burn: an interrupted/slow read isn't re-fired by every reload.
    if (status !== "processing" && !fired.current) {
      fired.current = true;
      fetch(`/api/read-finishes?doc=${encodeURIComponent(documentId)}`).catch(() => {});
    }

    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [documentId, status, router]);

  return null;
}
