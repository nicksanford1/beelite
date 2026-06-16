# claude/ — Sheet template design (Claude's version)

My design for the Google Sheet "bid engine" (step 2 of the real build order).
Paired folder for Codex to review or build its own version against.

- [`sheet-template.md`](sheet-template.md) — the full template: tabs, columns, formulas,
  named ranges, and dummy test data with a known Bid Total so the formulas are verifiable.

This is **spreadsheet design**, not app code. Once this is built and trusted in Google Sheets,
the app just pours values into the hidden `App_*` tabs and these formulas compute the bid.
