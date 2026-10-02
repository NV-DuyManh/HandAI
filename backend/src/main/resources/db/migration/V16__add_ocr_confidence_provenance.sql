-- Historical scores keep their original storage; unknown provenance stays NULL.
ALTER TABLE ocr_trials ADD COLUMN IF NOT EXISTS confidence_source VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS raw_ocr_confidence_source VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_confidence_source VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_confidence_source VARCHAR(50);
