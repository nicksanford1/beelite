"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Ingest writes each page to the DB the moment it renders, so pages can appear in the viewer
 * progressively. This refreshes the Plans page every few seconds while new pages are still arriving,
 * then stops once the count holds steady (ingest finished) — or after a hard cap so it never polls
 * forever if ingest failed.
 */
export function PlansAutoRefresh({ count }: { count: number }) {
  const router = useRouter();
  const prev = useRef(count);
  const stable = useRef(0);
  const polls = useRef(0);

  useEffect(() => {
    if (count === prev.current) stable.current += 1;
    else {
      stable.current = 0;
      prev.current = count;
    }
    // Stop once we have pages and the count has held steady for ~3 cycles (ingest done), or after a cap.
    if (count > 0 && stable.current >= 3) return;
    if (polls.current >= 45) return; // ~3 min ceiling
    polls.current += 1;
    const t = setTimeout(() => router.refresh(), 4000);
    return () => clearTimeout(t);
  }, [count, router]);

  return null;
}
