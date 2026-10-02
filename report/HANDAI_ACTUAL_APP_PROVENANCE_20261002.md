# Actual app evidence and provider configuration audit

02 October 2026, Asia/Saigon. This is a read-only PostgreSQL/MinIO audit, configuration/provenance repair and export of an actual GUI-created trial. No image generation, model training, commit, or historical record deletion was performed.

## Why the previous fresh run did not receive AI

`ai-service/app/config.py` loaded `.env.local` before `.env`. Pydantic gives later environment files priority, so empty provider key defaults in `.env` replaced the owner's existing provider key lists in `.env.local`. Effective configuration showed zero Groq and zero Gemini keys despite local files containing configured values. Key values were never printed or copied into evidence.

The repair orders base environment files before local environment files, removes duplicate absolute paths, and preserves operating-system environment variable priority. A regression uses dummy keys to verify blank base defaults, local overrides, duplicate path handling, and process overrides. Focused verification: **23 tests passed**, including the existing confidence integrity checks. The effective configuration after the repair reports **9 Groq keys and 7 Gemini keys**. These counts describe configuration, not successful inference.

The AI service restarted through the existing hidden launcher and became ready in **8.5 seconds**. Its live health response reports the primary Groq model available and the configured fallback unavailable with a model-not-found response. The backend restarted through its existing hidden launcher and became ready in **24.8 seconds**. Guest app routes are available without a student account:

- `POST /api/v1/handai/ocr/multiline/detect`
- `POST /api/v1/handai/ocr/multiline/trials`
- `GET /api/v1/handai/ocr/multiline/trials/{trialId}`

Fresh GUI evidence must come through these application routes and be captured from the application. Exporting old records or using an automatically invoked API does not establish a new physical-phone observation.

## Existing stored sessions are not all trustworthy AI evidence

At the pre-GUI audit, the database contained **17 multiline trials and 158 lines**, with **7 explicitly stored reference lines**. All 17 original page images were read from the backend's `mathvision` bucket; each byte hash matched its database SHA-256. The page images are existing stored photographs, not generated assets.

However, **55 lines across 10 trials** carry `LOCAL_ADVISOR_APPLY`. **38 rows** contain contradictory provider provenance: parallel fields say `SUCCESS` while structured suggestions record `UNAVAILABLE`. The old local advisor substituted plausible poem text into those provider fields. Such records, including the 12-line session shown in the owner's older phone screenshots, must not be described as authenticated cloud AI inference or used to claim an AI accuracy improvement. Historical model scores lack the new source tag and must not be relabeled as verified current confidence.

Only six earlier lines have consistent structured cloud fields in trials without local advisor substitution. The saved structured response and parallel fields agree, but the audit does not have independent HTTP receipts for these historical calls. Consequently, no fresh AI gain or generalized accuracy is claimed from that small historical subset.

Evidence files: `.work/actual_app_evidence_20261002/historical_persisted_trials.json`, `historical_persisted_lines.json`, `historical_provenance_audit.json`, and `historical_original_images/`. The audit contains row identities and source hashes, not credentials. Original history remains intact.

## Historical candidate guard and current provider consistency

The shared mobile advisor view and backend response DTO now reject explicit `LOCAL_ADVISOR_APPLY` and provider fields contradicted by an explicit structured outage. False cloud candidates and self-reported scores are unavailable; the saved raw and selected text remain intact. Backend response conversion does not mutate database history. A live read of the owner's old 12-line session confirms all six locally substituted lines have their false cloud candidates hidden while raw text and historical selected text remain stored.

Background review also saves model identifiers and structured suggestions from the exact current response, alongside its provider statuses and scores. This prevents an authentic later success from being contradicted by stale structured outage data from the initial request. The focused service regression starts with an unavailable record and verifies that the real successful response survives the DTO guard.

Validation: **27 mobile provider-integrity tests passed**, TypeScript passed, changed source lint had zero errors, and **15 backend tests passed across three focused classes**, with no failures or errors. Scoped `git diff --check` passed. The backend restarted hidden after validation and became ready in **18 seconds**. The read-only live API verification is `.work/actual_app_evidence_20261002/legacy_api_guard_verified.json`.

## Fresh actual GUI trial

The current Expo web app created trial **`400b509c-bded-44c0-add3-f3f74ee102c4`** through its actual guest detect/create routes at 11:42 ICT. The exact stored page is 932×916 pixels, 250,984 bytes, SHA-256 `861275dd8f5f225cc3863047dedfb01627a9ebe681193455ff32c57d110fd17e`; all 12 stored crop hashes match their database records. The screenshots show the running web app, not a recreated UI or a new physical-device capture.

Actual document review issued one Groq HTTP 200 at 11:42:27 ICT. Its persisted `qwen/qwen3.8-27b` outputs have SUCCESS provenance on all 12 lines. Five Gemini requests returned HTTP 400 and its candidates/scores remain null. The earlier line-detection cache has separate actual request provenance; cached detection/provider timings are not presented as new document-review HTTP latency. No local-advisor substitution exists in this new trial.

The app's local analytics received 12 image-transcribed references after inference. These are local reference entries; backend `verified_text_raw` remains null, and no manual backend feedback was submitted. With NFC and normalized whitespace while preserving case/punctuation, raw OCR matched **6/12** and actual Groq candidates matched **7/12**; the change is **+8.33 percentage points**. Raw corpus CER/WER are **8/194 (4.12%) / 9/48 (18.75%)**; AI CER/WER are **5/194 (2.58%) / 5/48 (10.42%)**. AI corrected lines 1/3/4/9 and damaged previously correct lines 6/7/10. The mean stored CRNN score is **94.18%**, uncalibrated and distinct from exact-line accuracy. These are results for one development image, not generalized performance or an independent benchmark.

Exports are `.work/actual_app_evidence_20261002/actual_gui_trial_api_response.json`, `actual_gui_trial_database.json`, `actual_gui_receipt.json`, `actual_gui_runtime_receipt.json`, `actual_gui_line_results.csv`, exact original/crop JPEGs and the separately scoped `actual_gui_scored_metrics.json`. No provider key values are included.

## Skills Applied

- `ponytail`
  - SKILL.md: `.agents/skills/ponytail/SKILL.md`
  - Why selected: minimal configuration repair and read-only backend provenance inspection.
  - Applied to: reusing existing launchers and API routes, preserving process environment overrides, focused regression checks, and avoiding new dependencies or fabricated data.

- `vercel-react-best-practices`
  - SKILL.md: `.agents/skills/react-best-practices/SKILL.md`
  - Why selected: the shared React Native advisor view controls which candidates reach display and analytics.
  - Applied to: an early provenance rejection in the existing shared helper, no extra requests or component state, and focused regressions for contradictory historical payloads.
