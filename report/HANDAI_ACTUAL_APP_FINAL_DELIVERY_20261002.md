# HandAI completed delivery · 2 October 2026

The completed set is `deliverables/HandAI_Actual_App_Corrected_20261002`, with all five Office deliverables and the separate portrait spoken script. `deliverables/HandAI_Complete_Actual_App_20261002.zip` contains the complete set, native PDF previews, original evidence and per-file SHA-256 manifest. Earlier delivery folders are retained as historical copies and are not the current final set.

## Actual result and scope

The actual Expo web GUI uploaded the owner's image and created trial `400b509c-bded-44c0-add3-f3f74ee102c4`. The submitted JPEG and twelve stored line crops match their recorded byte hashes. Detection reused the actual same-image response; the app's twelve displayed boxes were not redrawn for the documents or manually adjusted in this trial.

The real Groq document-review call returned HTTP 200 and twelve successful stored candidates, with model `qwen/qwen3.8-27b`. Gemini returned unavailable. The two metric columns use the same twelve image-transcribed references, entered through the app after inference; the raw OCR, provider candidates and selected output were left untouched. The reference entries are app-local, while backend feedback reference fields remain null.

- OCR: 6/12 exact lines (50.00%); CER 8/194 (4.12%); WER 9/48 whitespace tokens (18.75%).
- Actual Groq candidates: 7/12 exact lines (58.33%); CER 5/194 (2.58%); WER 5/48 (10.42%).
- Net exact-line change: +8.33 percentage points. Four wrong lines became correct; three correct lines became wrong. Manual edits are excluded from the AI column.
- Mean recorded CRNN score: 94.1808%, range 83.31–97.55%, explicitly uncalibrated. Provider scores remain separately tagged as self-reported.

This is one development image and one actual app trial, not an unseen-writer benchmark or generalized accuracy claim. Independent human verification of the references remains pending. The historical checkpoint's training/validation population and CER remain separately scoped in the documents.

## Complete artifacts and visual verification

- Main report: 25 native Word PDF pages inspected. A compact home-action crop, actual image/line-review capture, genuine comparison/history/line-card images and editable source-count tables replace the earlier evidence. All twelve raw/AI/reference rows and all twelve confidence/edit-count rows remain visible. Body text is regular Arial, dark table headers have white text, compact tables are kept together, the roadmap caption stays with its table, and the contents page was refreshed. Superseded image relationships were removed.
- Action Plan: 8 pages; Evaluation Sheet: 5 pages; WBS: 2 print pages. The supporting-file audit preserves assessor fields, official evaluation rubric, the 30-day dates/statuses, validation and all 810 conditional-format formulas.
- Presentation: 20 slides; 245 native text regions checked; zero overflow. All twenty slides visually reviewed. Six embedded content images match genuine source or screenshot crop hashes. The screenshot pixels are cropped only and are explicitly web-app evidence.
- Spoken script: portrait A4, 3 pages, twenty plain `Slide N:` sections, no table; DOCX/TXT and PowerPoint notes match.
- Every deliverable was checked for obsolete Artificial Intelligence Course and 20-day-plan labels. The common course label is Big Data and the planning baseline is 01–30 September 2026.

The package audit independently recalculates character/token edit counts and exact matches from the actual API strings, verifies all thirteen image byte hashes, checks script orientation/section count, checks native PDF page counts and tests ZIP integrity. Details are `verification/final_package_checks.json`, `verification/final_deck_audit.json`, `verification/actual_forms_integrity.json` and `verification/file_manifest.json` in the delivery folder.

## Code and runtime verification

The existing source now retains genuine CRNN score provenance, separates raw/actual-AI/manual stages, guards legacy locally substituted provider fields, persists current provider metadata consistently and has separate complete history with selected/all deletion confirmation and incomplete-entry cleanup. Local environment override order was repaired so configured provider credentials reach the runtime without being exposed in evidence.

The actual GUI run also exposed browser-upload and line-overlay defects. The image pipeline and draft preserve browser Blob/data URIs; browser multipart sends actual image bytes; line-review coordinates use the displayed image width and height at the real viewport. The resulting app capture shows all twelve boxes aligned on the owner image.

Focused validation records: 23 AI tests, 27 provider-integrity mobile tests and 15 backend tests passed. The final five mobile regression suites passed all 101 assertions with exit 0; the test harness preserves Expo's lazy fetch descriptor and mocks the platform property without replacing the React Native module. TypeScript and changed-source lint passed in this phase. Genuine GUI evidence covers upload, review, recognition, stored detail, reference entry, summary, separate history and deletion confirmation. A final Delete All confirmation interrupted browser automation; on reinspection there was no pending dialog and the web archive was empty. No acceptance was issued by the agent. The original server trial and exported evidence remain unchanged. The genuine screenshots in the documents record the earlier measured app state; they are not claimed to show the archive after this final check. An attempted re-save without the original draft produced an incomplete local image entry; normal history cleanup removes it. The owner's physical-phone archive was not accessed or cleared.

No model training, commit or push was performed. No physical-device run is fabricated. No generated handwriting photograph, redrawn evidence UI, preset advisor candidate, API credential or environment file is included in the package.

## Skills Applied

- `slides`
  - SKILL.md: `.agents/skills/slides/SKILL.md`
  - Why selected: global layout correction of the defense presentation.
  - Applied to: twenty slides, readable tables, evidence placement and consistent grid.
- `docx`
  - SKILL.md: `.agents/skills/docx/SKILL.md`
  - Why selected: main report, Action Plan, Evaluation and portrait script.
  - Applied to: typography, compact table pagination, original image fitting and native Word page verification.
- `xlsx`
  - SKILL.md: `.agents/skills/xlsx/SKILL.md`
  - Why selected: the existing 30-day editable WBS.
  - Applied to: structural preservation, current evidence note and native Excel print verification.
- `vercel-react-best-practices`
  - SKILL.md: `.agents/skills/react-best-practices/SKILL.md`
  - Why selected: browser image flow and React Native review/history behavior.
  - Applied to: minimal URI/coordinate corrections, shared provenance and focused regressions.
- `ponytail`
  - SKILL.md: `.agents/skills/ponytail/SKILL.md`
  - Why selected: configuration, backend consistency and minimal code repairs.
  - Applied to: existing API/launchers and native platforms, no new production dependencies.
- `control-in-app-browser`
  - SKILL.md: `C:/Users/Admin/.codex/plugins/cache/openai-bundled/browser/26.928.21956/skills/control-in-app-browser/SKILL.md`
  - Why selected: capture actual visible application behavior.
  - Applied to: real GUI upload/reference flow, original screenshots and final history inspection.

The native PowerPoint workflow also follows the installed `Presentations` skill; its exact path and artifact checks are recorded in `report/HANDAI_SLIDE_LAYOUT_CORRECTION_20261002.md`.
