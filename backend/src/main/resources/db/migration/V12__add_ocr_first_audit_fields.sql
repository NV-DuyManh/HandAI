ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS recognition_engine VARCHAR(50);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS segmentation_source VARCHAR(50);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS correction_source VARCHAR(50);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS final_text_source VARCHAR(50);

ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS raw_ocr_confidence DOUBLE PRECISION;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS corrected_text TEXT;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS correction_confidence DOUBLE PRECISION;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS correction_applied BOOLEAN;
ALTER TABLE ocr_multiline_lines ADD COLUMN IF NOT EXISTS correction_decision VARCHAR(50);
