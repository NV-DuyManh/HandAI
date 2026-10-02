# HandAI measured delivery — 2 October 2026

## Outcome

The working tree now preserves actual OCR confidence and provider provenance, separates original OCR from actual AI-only output and manual edits, and provides a separate history page with full stored-line inspection and confirmed selected/all deletion. The backend and AI service were restarted locally with these changes. No commit, push or model training was performed.

The five submission artifacts are in `deliverables/HandAI_Measured_Reports_20261002`, together with a portrait presentation script and plain-text copy. Course naming is Big Data; the planning baseline covers 30 continuous days; the deck has 20 slides. Native measurements and selected actual app captures replace unsupported headline results. Important model/evaluation parameters are retained.

## Measurement and claim boundaries

- Source: one owner-provided poem image, one actual inference run on 2 October 2026; 12 automatically detected lines. No reference-count forcing and no canonical text override.
- Original OCR: **7/12 exact lines (58.333333%)**; **9/194 character edits (CER 4.639175%)**; **9/48 whitespace-token edits (WER 18.75%)**.
- Actual OCR score: **94.335% mean**, 79.79–97.44% range, from emitted non-blank CTC character peak softmax probabilities. It is uncalibrated and is not a probability that a whole line is correct.
- Reference text was manually transcribed from the owner image after inference for this development audit. Independent human verification has not been completed. This is not a frozen, unseen-writer benchmark or calibration dataset.
- Groq and Gemini were unavailable because keys were not configured; zero HTTP requests, zero AI-paired reference lines and null AI accuracy/gain. No AI performance value is invented.
- Historical checkpoint evidence remains separate: declared 500-sample validation split and recorded CER 11.3388%, with training/subset/comparable-step values and their limits retained.
- Current app captures show the actual receipt imported into isolated Expo Web QA history. They are not new physical-device evidence. Owner-supplied phone captures are labeled historical workflow evidence.

Machine-readable evidence is included in the delivery package: source-image/checkpoint hashes, segmentation and inference receipts, per-line reference/error/score records, token uncertainty diagnostics, 12 line crops, the actual detector overlay and selected app captures.

## Implementation verification

| Area | Result |
| --- | --- |
| AI confidence/provider/request tests | 58 passed |
| Mobile report/history/confidence/routing tests | 135 passed in six suites |
| Existing suggestion matrix, run through installed TypeScript transpiler | 59 cases passed |
| Backend confidence/service/serialization tests | 13 passed, zero failures/errors |
| Mobile TypeScript | Passed |
| ESLint on changed mobile application source | Passed |
| Expo Web production export | Passed; 28 routes |
| Scoped code whitespace check | Passed; unrelated pre-existing whitespace was preserved |
| Local backend deployment | Health UP, database UP; V16 migration and all four provenance columns verified |
| Local AI deployment | Health ok; live API exposes provenance fields |

History QA used an isolated imported measured receipt: selection, full 12-line detail, confirmed deletion, empty state and persistence after reload were checked. The production phone's local history was not accessed or cleared by this QA.

## Artifact and visual verification

| Artifact | Native verification |
| --- | --- |
| Final report DOCX | 29 pages; actual per-line data, diagnostics, provenance, scope and app captures retained |
| Action plan DOCX | 8 pages; 30-day baseline and current evidence limits |
| Evaluation sheet DOCX | 5 pages; reviewer fields preserved and team revision date 2 October |
| WBS XLSX | Two sheets/two printed pages; 30 dates, 810 timeline conditional-format formulas and status validation preserved |
| Defense deck PPTX | 20 slides; no out-of-canvas shapes; original aspect ratio and image proportions preserved |
| Presentation script DOCX/TXT | Four portrait pages; 20 simple numbered narration blocks, exactly matching PowerPoint notes |

PowerPoint, Word and Excel native exports were rendered and visually inspected. Final localized adjustments were rechecked at readable page/slide size, including source-crop legibility, the slide 12 metric layout, the complete line 4 score card, report analytical tables and evaluation cover. Final reference-scope wording and the segmentation-category description were corrected, and report contents/page numbers refreshed.

An independent read-only artifact audit is recorded in `report/HANDAI_MEASURED_ARTIFACT_AUDIT_20261002.md`. Deployment evidence is recorded in `report/HANDAI_CONFIDENCE_DEPLOY_20261002.md`.

## Remaining evidence limits

The code and artifact revision is ready for review. Measuring AI-stage improvement requires a configured provider and actual successful responses on the same reference lines. General accuracy and confidence calibration require a separate, independently verified held-out dataset. Neither is claimed by this package. New physical-device validation remains unperformed.

## Skills Applied

- `ponytail`
  - SKILL.md: `.agents/skills/ponytail/SKILL.md`
  - Why selected: Simple confidence/provenance and service-integrity fixes.
  - Applied to: AI/backend score handling and minimal launcher repair.
- `vercel-react-best-practices`
  - SKILL.md: `.agents/skills/react-best-practices/SKILL.md`
  - Why selected: React Native screen and state changes.
  - Applied to: Summary, history, full-line detail, persistence and deletion flow.
- `ui-ux-pro-max`
  - SKILL.md: `.agents/skills/ui-ux-pro-max/SKILL.md`
  - Why selected: Readable report/history comparison and scope presentation.
  - Applied to: OCR/AI columns, count context, unavailable states and stored-line review.
- `slides`
  - SKILL.md: `.agents/skills/slides/SKILL.md`
  - Why selected: Presentation layout and narrative consistency.
  - Applied to: 20-slide deck, actual image crops, editable measurements and synchronized notes.
- `docx`
  - SKILL.md: `.agents/skills/docx/SKILL.md`
  - Why selected: Native Word artifact editing and format inspection.
  - Applied to: Report, plan, evaluation and portrait narration.
- `xlsx`
  - SKILL.md: `.agents/skills/xlsx/SKILL.md`
  - Why selected: WBS date/formula/validation and printing checks.
  - Applied to: 30-day workbook and evidence-scope note.
