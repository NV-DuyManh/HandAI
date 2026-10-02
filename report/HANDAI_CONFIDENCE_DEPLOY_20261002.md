# HandAI confidence — local deployment verification

Verified on 02 October 2026 (Asia/Saigon). Both local services were restarted to load the confidence changes. This is local process, HTTP, database, and automated-test evidence; no physical-device test is claimed.

## Confidence integrity

- Raw CRNN confidence is accepted only when it is finite, within `[0, 1]`, and tagged `CRNN_CTC_SOFTMAX`. A real zero is preserved. Missing, invalid, or legacy untagged values are returned as unavailable, without inventing a default or inferring provenance from a model name.
- `/recognize-line` confidence and `confidence_source` now reach persistence and the API response, including the multiline recognition fallback.
- Multiline raw text and its model score remain separate from the selected final text. AI selection or a human edit does not replace the original raw model confidence.
- Provider confidence is nullable and requires successful provider status plus `AI_SELF_REPORTED` provenance. It is an AI-reported estimate, not verified accuracy or a calibrated probability. Ambiguous generic correction confidence remains unavailable.
- Background AI review receives the original stored page bytes as `imageBase64` only when their SHA-256 matches the trial's stored image hash. No substitute blank image is sent.
- Migration V16 adds provenance columns without relabeling historical scores.

Sources: `backend/src/main/java/com/mathvisionkids/api/ocr/OcrConfidence.java`, `OcrPilotService.java`, `OcrTrialResponse.java`, and `ocr/multiline/OcrMultilineService.java`, `LineBoxDto.java`, `MultilineLineResponse.java`.

## Automated verification

Command run from `E:\HandAI\backend`:

```powershell
.\gradlew.bat test --tests com.mathvisionkids.api.ocr.OcrConfidenceTest --tests com.mathvisionkids.api.ocr.multiline.OcrMultilineServiceTest --tests com.mathvisionkids.api.ocr.multiline.OcrMultilineSerializationTest --rerun-tasks
```

Result: `BUILD SUCCESSFUL`; **13 tests, 0 failures, 0 errors**. The three JUnit XML suites contain 3 confidence-validation tests, 7 service tests, and 3 serialization tests. They cover provenance/range handling, persistence and recognition fallback, raw versus selected text, real-image advisor payload, and unavailable confidence serialization.

Test XML evidence: `backend/build/test-results/test/TEST-com.mathvisionkids.api.ocr.OcrConfidenceTest.xml`, `TEST-com.mathvisionkids.api.ocr.multiline.OcrMultilineServiceTest.xml`, and `TEST-com.mathvisionkids.api.ocr.multiline.OcrMultilineSerializationTest.xml`.

## Backend restart and database

The listener on port 8080 was identified through native Windows process inspection as Java PID **2400**, running `com.mathvisionkids.api.BusinessApiApplication` from `E:\HandAI\backend`. Its start time, **08:58:37 +07**, preceded the confidence changes. Only that verified project process was stopped.

The existing `infra/start-backend.ps1` launched the backend hidden, using the existing Gradle wrapper and configuration. Its readiness check completed in **24.7 seconds** and emitted `[OK] BACKEND API IS ALIVE`. The new project Java PID is **25228**, started **10:29:47 +07**. Tomcat was ready at **10:30:04 +07**. Independent HTTP checks returned `UP`, including database component `UP`.

Flyway logged migration from public schema version 15 to **16** at **10:29:54 +07**, with one migration successfully applied. A direct read-only PostgreSQL query independently returned:

```text
16|add ocr confidence provenance|t
ocr_multiline_lines|gemini_confidence_source|character varying
ocr_multiline_lines|groq_confidence_source|character varying
ocr_multiline_lines|raw_ocr_confidence_source|character varying
ocr_trials|confidence_source|character varying
```

Launcher evidence: `.work/confidence_integrity_20261002/evidence/backend_restart_launcher.log`. Service startup and migration evidence: `infra/logs/backend.log`.

## AI service restart

The old port-8001 worker PID **33080** started **08:57:36 +07**, before the changed confidence/provider files, and did not use `--reload`. Its parent PID **17672** was verified as `E:\HandAI\ai-service\.venv\Scripts\python.exe`, running this project's `uvicorn app.main:app` command.

The existing `infra/start-ai.ps1` contained a blank line after a backticked `-WorkingDirectory` argument. PowerShell parsed the logging, hidden-window, and `PassThru` arguments as a separate command. Removing that single blank line restored them to `Start-Process`; the parsed launcher now includes `WindowStyle`, output/error redirection, and `PassThru` together.

The repaired existing launcher restarted the service hidden with the same project virtual environment and uvicorn arguments. Its readiness check completed in **8 seconds** and emitted `[OK] AI MICROSERVICE IS ALIVE`. The new worker PID is **27020**, parent **32408**, started **10:33:43 +07**. `/health` returned `ok`. The running `/openapi.json` includes `OcrRecognizeLineResponse.confidence_source` and the `LineBox` fields `rawOcrConfidenceSource`, `groqConfidenceSource`, and `geminiConfidenceSource`, confirming that the restarted API exposes the updated confidence contract.

Launcher evidence: `.work/confidence_integrity_20261002/evidence/ai_restart_launcher.log`. Startup evidence: `infra/logs/ai-service.err.log`.

No cloud provider request or model training was performed for deployment verification. Existing configuration files were preserved. No commit or push was made. Process IDs and health readings are a snapshot of this verification, not a promise of future availability.

## Skills Applied

- `ponytail`
  - SKILL.md: `.agents/skills/ponytail/SKILL.md`
  - Why selected: backend confidence validation, minimal API/database changes, and a necessary PowerShell launcher repair.
  - Applied to: reuse of existing launchers and validation boundaries, the one-line launcher fix, focused verification, and avoiding configuration or infrastructure changes.
