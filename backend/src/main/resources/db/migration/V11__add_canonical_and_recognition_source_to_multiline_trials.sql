-- V11: Add canonical matching and recognition source to ocr_multiline_trials
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS canonical_matched BOOLEAN DEFAULT FALSE;
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS fixture_id VARCHAR(100);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS recognition_source VARCHAR(50);
