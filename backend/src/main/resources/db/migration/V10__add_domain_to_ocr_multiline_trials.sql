-- V10: Add domain to ocr_multiline_trials for provenance tracking
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS domain VARCHAR(50) NOT NULL DEFAULT 'HANDWRITING_TEXT';
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_trials_domain ON ocr_multiline_trials(domain);
