# Estimate flow — agreed build spec (v1)

**Status:** agreed by owner; GPT proposed, Claude concurs. This resolved an earlier A-vs-B fork —
the answer is **Proposal C**.

**Guiding principle:**
> The user uploads plans. AI organizes the bid. The user verifies the output, enters quantities, and
> syncs to Google Sheets. **No mandatory page tagging. No giant form before upload.**

---

## The decision: Proposal C (not A, not B)

One bad result (Lake Shore) did **not** prove whole-doc reading is wrong — it proved the **prompt was
under-specified** (it never told the model "if there's no finish schedule, return empty; don't extract
wall sections / assemblies / structural materials"). So:

- **Keep the one-click whole-doc read** (simple UX, no tagging).
- **Add a finish-schedule *detector* + confidence gate** so the model must *prove a schedule exists*
  before extracting finishes, and returns a clean "no schedule found" when it doesn't.
- **Page-index = invisible infrastructure / fallback**, not a user chore. Used only for source-page
  references, "open the relevant page," debugging, and the *ambiguous* fallback — never a required step.
- **Test before switching architecture.** Don't adopt page-targeting as the default until a real test
  set shows the guarded whole-doc read isn't good enough.

### The guarded read returns one of three states
```
1. finishes_found
2. no_finish_schedule_found
3. ambiguous_finish_info
```

### Required output schema
```json
{
  "finish_schedule_status": "found | possible | not_found",
  "confidence": 0.0,
  "reason": "why",
  "evidence_pages": [],
  "finishes": []
}
```
Lake Shore's correct result:
```json
{ "finish_schedule_status": "not_found", "confidence": 0.94,
  "reason": "Shell/permit/structural set — general notes + wall/section assemblies, no flooring finish schedule.",
  "evidence_pages": [], "finishes": [] }
```
That is a **successful read**, not a failure.

### The hard rule (prompt)
The model may NOT extract a finish unless it can answer *"where did this come from — was it listed as a
floor/room finish, finish code, material schedule item, or flooring spec?"*
- **Reject:** gyp board, insulation, subfloor, concrete slab, wall/roof assemblies, metal stud, sheathing,
  framing — unless explicitly listed as a flooring finish item.
- **Accept:** LVT-1, RF-1, CPT-1, RB-1, TILE-1, TURF-1, resilient/rubber flooring, carpet tile, porcelain
  tile, wall base, etc.

### Validate before committing (don't decide on 1 PDF)
Run **20–30 PDFs** across buckets: (1) clear finish schedule, (2) finish plan but no schedule, (3) no
flooring scope (shell/structural/MEP/permit), (4) messy/partial. Compare **A (current)** vs **A2 (guarded
whole-doc)** vs **B (page-index → targeted)**. Score per PDF: detected schedule-exists correctly? avoided
out-of-scope? right finish codes? missed obvious codes? returned source pages? cost? latency? The metric
that matters: **did it return the *right* answer — including empty when empty is correct?**

---

## Full product flow

1. **Bids / Estimates list** — Project · GC/Customer · Location · Bid Due · Status · Estimator · Scope ·
   Sheet Status · Last Updated · Actions. Top: Import · **+ New Estimate**.
2. **New Estimate (upload-first)** — "Upload a plan set to start. We'll read the PDF, fill in project
   details, identify likely flooring info, and prepare the estimate for review." Drop PDF / Browse.
   Optional: GC/Customer · Bid Due · Estimator · Internal Bid # · Notes.
   *Behind the scenes:* create bid record → upload to storage → split pages → store images + text → cover
   read → extract project details → build a light hidden page index.
3. **AI fills project details** — processing state, then fields fill (name, address, city, state, owner,
   architect, project type, plan date). Missing fields stay blank ("Not found"). User can edit anything.
   Light confidence indication, not overcomplicated.
4. **Review & Create** — summary (project / plans / what AI found / what's missing) → **Create Estimate**.
   Sets status "Plans Uploaded · Ready to Read Finishes" → into the workspace.
5. **Estimate Overview** — left sidebar: Overview · Plans · Finishes · Takeoff · Rates · Scope · Sheet
   Sync · Bid. Shows status + next step + AI summary. Primary: **Read Finishes**. Secondary: Open Plans ·
   Pass / Not a Fit · Edit Project Info.
6. **Plans screen** — PDF preview + thumbnails + Open full PDF + AI plan summary. An **"AI Page Index"**
   section, collapsed/secondary — *supporting evidence, NOT a required tagging step.* Main button stays
   **Read Finishes**.
7. **Full PDF viewer** — clean reader: Back to Estimate · name · page selector · search · zoom · fit ·
   download · fullscreen; thumbnails at bottom. No sidebar/AI clutter.
8. **Read Finishes** — guarded whole-doc read (strict prompt above) → returns one of the three states.
9. **Outcome A — finishes found** → Finishes screen: table (Code · Type · Product · Source Page ·
   Confidence · Include). Actions: confirm/edit/exclude/add-missing/open-source-page/delete. Button:
   **Confirm Finishes** → status "Finishes Confirmed" → Takeoff.
10. **Outcome B — no finish schedule found** → "No Finish Schedule Found" + what we *did* find + actions:
    Upload More Plans · Manually Add Finishes · Pass / Not a Fit · Open PDF · *Advanced: Scan Anyway*.
    Pass reason picker: no finish schedule · not flooring scope · incomplete plan set · wrong trade ·
    too little info. *(This is the Lake Shore case handled correctly.)*
11. **Outcome C — ambiguous** → "Possible Finish Information Found" + candidate pages. Actions: Review
    Possible Pages · Extract Anyway · Manually Add · Upload More · Pass. *(Where the hidden page index
    earns its keep — still optional.)*
12. **Takeoff** — **Fast Takeoff (v1):** Finish Code · Material Type · Total SF · Waste % · Billable SF ·
    Base LF · Notes (app computes billable; Sheet still does real pricing). **Detailed Takeoff (later):**
    Area/Room · Finish · SF · Base LF · Notes · Source Page.
13. **Rates** — connect finishes to pricing categories (Sheet stays the engine): Finish Code · Material
    Type · Rate Category · Waste % · Labor Category · Sheet Mapping. Standardized categories so formulas
    improve over time. Button: Confirm Rates.
14. **Scope** — inclusions / exclusions / clarifications / open questions / risk warnings. AI suggests
    scope notes from the finishes found (e.g. rubber → confirm adhesive; turf → infill in/out; LVT →
    moisture mitigation excluded unless specified). Checkboxes: Include · Exclude · Clarify · Ignore.
15. **Sheet Sync** — preview what goes to Sheets (Project Info · Finishes · Takeoff · Rates · Scope).
    Buttons: Create Google Sheet · Sync to Existing · Preview Changes · Open Sheet. **Never silently
    overwrite.** After: "Synced · Last synced …".
16. **Bid** — final status: total · sheet link · proposal status · submitted date · win/loss. V1: Open
    Sheet · Mark Submitted/Won/Lost/No Bid. Feeds historical data on the dashboard.
17. **Activity log** — background traceability (uploaded · details extracted · finishes read · no schedule
    · manual adds · confirmed · quantities · synced · submitted · won/lost).

---

## Clean V1 scope (build only this)
1. Bids list 2. New Estimate (upload-first) 3. AI project-detail extraction 4. Estimate Overview
5. Plans/PDF viewer 6. **Read Finishes with three outcomes** 7. Finishes review table 8. Fast Takeoff by
finish code 9. Scope notes 10. Google Sheet sync 11. Bid status tracking.

**Skip for now:** detailed room-by-room takeoff · templates · deep reports · proposal generator · full
CRM · advanced team permissions.

> The product should feel like: **upload the plans, let AI prepare the bid structure, verify what it
> found, enter quantities, and push clean data into the Google Sheet.**

---

## Immediate next build (Claude)
The lynchpin is step 8. Build it first:
1. **Rewrite the read prompt + output schema** to the guarded 3-state form (`finish_schedule_status`,
   `confidence`, `reason`, `evidence_pages`, `finishes`) with the strict accept/reject rules.
2. **Make `/finishes` render the 3 outcomes** (found → review table w/ source pages; not_found → the clean
   no-schedule screen + Pass; ambiguous → candidate pages).
3. *Then* run the 20–30 PDF test set (A2 guarded whole-doc) before deciding if targeted page reads are
   ever needed.
