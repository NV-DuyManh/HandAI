# Actual app supporting Office artifacts — 2 October 2026

The Action Plan, Evaluation Sheet and WBS in `deliverables/HandAI_Actual_App_Corrected_20261002` now use actual GUI trial `400b509c-bded-44c0-add3-f3f74ee102c4`, its stored source image, and the actual app capture. No generated detection overlay or locally substituted AI output is embedded. Unused image relationships from the old Action Plan were removed.

## Recorded evaluation scope

- One development image, one GUI trial, 12 reference lines entered in the app's local analytics after inference. The backend's `verified_text_raw` remains null; these are not described as 12 backend reference records or as an independent test set.
- Raw OCR: 6/12 exact lines (50.00%), CER 8/194 (4.12%), WER 9/48 (18.75%). Actual Groq candidates: 7/12 exact (58.33%), CER 5/194 (2.58%), WER 5/48 (10.42%). Four previously wrong lines became correct; three previously correct lines became wrong. The paired exact-line change is +8.33 percentage points.
- Groq `qwen/qwen3.8-27b` produced 12 stored successful outputs. A real document-review HTTP 200 is recorded. Gemini returned five HTTP 400 responses and remains unavailable. Provider self-reported scores do not become measured recognition accuracy.
- Mean stored CRNN score: 94.18%, tagged `CRNN_CTC_SOFTMAX`, uncalibrated. Manual edits do not count in the AI column.
- The 59,462 training samples, 500 validation samples and recorded checkpoint CER 11.3388% remain separate handoff evidence. No model training or independent benchmark was run.

## Formatting and verification

Word table bodies explicitly use regular Arial and left-aligned prose; headings and table headers remain bold. The Evaluation TRL instruction is now two short lines with spacing before the table. All official rubric text, weighting, score choices and evaluator signature/comment fields remain unchanged and unscored. The Action Plan retains D1–D30, uses actual photo/capture crops, and keeps its finalization routine on one page.

The WBS retains all 30 dates, task statuses, 810 conditional-format formulas, validation ranges, merged cells, freeze panes and print areas. Only the evidence note, one delivery label and regular body font weights were refreshed. Native Excel recalculation and PDF printing completed successfully.

Native Word PDF/Poppler inspection covered 8 Action Plan pages and 5 Evaluation pages; native Excel inspection covered 2 printed pages. No overlap, clipped text, blank spill page or orphan table row remains. The earlier apparent outlined/alternately heavy body text was an EMF/GDI rendering artifact; the native PDF rendering verifies regular text.

Evidence and reproducibility: `.work/actual_app_evidence_20261002/actual_forms_integrity.json`, `actual_forms_qa.json`, `actual_gui_receipt.json`, `actual_gui_runtime_receipt.json`, `actual_gui_scored_metrics.json`, `update_actual_forms.py` and native PDFs/page PNGs under `office_qa/`.

## Skills Applied

- `docx`
  - SKILL.md: `.agents/skills/docx/SKILL.md`
  - Why selected: formatting and preserving native Word plans and official evaluation forms.
  - Applied to: explicit run weights, table layout, image fitting, blank assessor fields and native page verification.
- `xlsx`
  - SKILL.md: `.agents/skills/xlsx/SKILL.md`
  - Why selected: updating an existing editable 30-day Excel schedule.
  - Applied to: formula/validation structural preservation, body formatting, evidence note and native Excel print verification.
