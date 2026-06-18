# Codex Review — Live Bug: Finish Read Never Reaches Anthropic

Reviewed `STATUS.md` against latest committed code:
`06f3491`, `91eac56`, `cfc57c6`, `375bf4d`, `86e13a0`, `ae264a2`, `a1698a4`, `540a91f`.
Static diagnosis/recommendation only; no tests run in this pass.

## Findings

1. **The Anthropic request is not the first bottleneck; `readSchedule` still re-downloads the full PDF.**
   `readSchedule` loads the whole stored plan with `downloadPlan(doc.fileUrl)` before extracting tagged
   pages (`app/actions.ts:140-147`). `downloadPlan` uses Supabase storage `.download()` and buffers the
   full blob (`lib/storage.ts:23-26`). The status diagnostics show this full-PDF download stalls before
   `extractPages` or Anthropic, which explains the empty Anthropic console. Changing Opus/Sonnet or
   tagging page 14 only will not fix the main path while it still has to pull the original 7.6MB PDF.

2. **The app already has PDF caches, but `readSchedule` cannot use them.**
   `/api/plan-pdf` keeps an in-process full-PDF cache for browser rendering (`app/api/plan-pdf/route.ts:7-20`),
   and `/api/preview` has separate PDF/page caches. The extraction server action bypasses those and
   calls `downloadPlan` directly. This duplicates the slowest operation and wastes the fact that upload
   and plan viewing already had the bytes. Create one shared server-side plan-byte cache/inflight
   dedupe helper keyed by document id or file path, use it from upload, plan-pdf, preview, rescan, and
   readSchedule. That is the fastest unblock for the current Codespace.

3. **The durable fix is to stop depending on the original PDF download at read time.**
   At upload time the server already has the full `bytes` in memory and scans every page. Persist
   derived artifacts then: page text for text-first extraction, and/or per-page PDFs/images for pages
   that need visual extraction. Then `readSchedule` can combine only the tagged page artifacts or send
   stored page text, without pulling the multi-MB source PDF again. For this AutoZone file, page 14
   appears text-heavy enough that a text-first extraction path would likely be much faster and avoid
   the dense page-13 floor-plan payload.

4. **The user-facing failure mode still needs hardening regardless of storage speed.**
   `readSchedule` has no staged logging, timeout, `try/catch`, or UI-visible error path around
   download, page extraction, or `extractFinishSchedule` (`app/actions.ts:121-162`). `extractFinishSchedule`
   creates the Anthropic client with no explicit timeout (`lib/anthropic.ts:43-65`). A slow storage
   read or model call leaves the button spinning and then apparently "does nothing." Add bounded
   timeouts, structured logs with document/pages/sub-PDF byte size, and return an error state to the
   Finishes UI. Only redirect after a saved `Extraction`; if zero finishes are returned, save/log that
   as an explicit completed empty extraction instead of looking like a failed click.

5. **Keep page filtering, but do not overfit the diagnosis to page 13.**
   Page 13 may be too dense to send to Anthropic and should probably be tagged as a floor/finish plan,
   while page 14 holds the real finish notes. But the confirmed no-usage symptom is explained by the
   full-PDF download stall. After the download path is fixed, re-test `pages=14` alone with Sonnet;
   only then decide whether page 13 should be excluded by UI guidance or scanner classification.

## Recommended Next Step

Implement the quick unblock first: introduce a shared `getPlanBytes(documentId)` cache with timeout and
inflight dedupe, seed it during `uploadDocument`, and replace direct `downloadPlan` calls in
`readSchedule`, `rescanDocument`, `/api/plan-pdf`, and `/api/preview`. In the same pass, make
`readSchedule` return a visible error instead of silently resetting. Then run `GET /api/diag?pages=14`
and, if it succeeds, remove `app/api/diag/route.ts`.
