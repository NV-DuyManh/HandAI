ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_suggestion TEXT;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_confidence DOUBLE PRECISION;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_decision VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_status VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS groq_model VARCHAR(100);

ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_suggestion TEXT;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_confidence DOUBLE PRECISION;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_decision VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_status VARCHAR(50);
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS gemini_model VARCHAR(100);

ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS suggestions_json TEXT;
