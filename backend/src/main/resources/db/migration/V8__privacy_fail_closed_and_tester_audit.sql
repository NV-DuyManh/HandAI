-- V8__privacy_fail_closed_and_tester_audit.sql
-- OCR.PILOT.1.2: Enforce privacy fail-closed (DEFAULT FALSE) and reset historical test rows

ALTER TABLE ocr_trials
ALTER COLUMN privacy_confirmed SET DEFAULT FALSE;

-- Historical test data was generated in automated development tests without physical masking verification
UPDATE ocr_trials
SET privacy_confirmed = FALSE
WHERE is_test_data = TRUE;
