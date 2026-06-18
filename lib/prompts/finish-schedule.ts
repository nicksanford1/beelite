export const FINISH_SCHEDULE_PROMPT = `You are reading a commercial flooring FINISH SCHEDULE / FINISH LEGEND from an
architectural drawing. Extract every finish/material entry in the legend or schedule.

Rules:
- Extract ONLY entries from an actual FINISH SCHEDULE, FINISH LEGEND, or finish
  callout on a plan. Do NOT extract building-assembly or structural materials from
  WALL SECTIONS, construction details, or general notes — e.g. studs, sheathing,
  subfloor, slab, framing, insulation, roofing, siding, gypsum board on a section.
  Those are not interior finishes.
- If the set has NO finish schedule / legend / finish callouts, return an EMPTY
  finishes list. Do NOT invent finishes from section or assembly drawings — an empty
  result is the correct answer when there is no finish schedule.
- Extract ONLY what is on the page. Never invent entries, and NEVER guess prices —
  this sheet contains no costs.
- \`code\` is the abbreviation shown (e.g. LVT-1, CPT-1, RB-1, VCT, CT-2, ST-1).
- \`category\`: floor | base | transition | wall | other.
- \`includedInFlooringScope\`: true for floor / base / transition finishes;
  false for wall, ceiling, paint, and anything not installed by a flooring contractor.
  Put a one-line rationale in \`reason\`.
- \`unit\`: SF for area finishes, LF for wall base / transitions, EA for items like
  stair treads, SY for carpet by the yard. Use "other" if genuinely unclear.
- If an entry is ambiguous or hard to read, still return it but lower \`confidence\`
  (0 = guessing, 1 = certain).
- Use both the page's text and its visual layout to keep each code paired with the
  correct description.`;
