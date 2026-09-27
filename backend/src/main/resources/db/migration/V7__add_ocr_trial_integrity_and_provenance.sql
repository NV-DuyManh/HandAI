-- V7__add_ocr_trial_integrity_and_provenance.sql
-- OCR.PILOT.1.1: Add domain isolation, test data flag, data origin, normalized text, and quarantine historical test data

ALTER TABLE ocr_trials
ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS domain VARCHAR(50) NOT NULL DEFAULT 'HANDWRITING_TEXT',
ADD COLUMN IF NOT EXISTS data_origin VARCHAR(50) NOT NULL DEFAULT 'PHYSICAL_USER',
ADD COLUMN IF NOT EXISTS verified_text_normalized TEXT,
ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 4);

CREATE INDEX IF NOT EXISTS idx_ocr_trials_is_test_data ON ocr_trials(is_test_data);
CREATE INDEX IF NOT EXISTS idx_ocr_trials_domain ON ocr_trials(domain);

-- Quarantine all prior test/synthetic rows so they are never eligible for training export
UPDATE ocr_trials
SET is_test_data = TRUE,
    training_eligible = FALSE,
    data_origin = 'AUTOMATED_TEST';
