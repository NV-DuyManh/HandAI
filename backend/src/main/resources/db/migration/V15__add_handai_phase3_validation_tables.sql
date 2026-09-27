-- V15: HandAI Phase 3 Research Validation Layer: AI Impact, Calibration & Root Cause Analysis
-- Establishes validation records:
-- 1. AI Impact Metrics (ocr_ai_impact_metrics)
-- 2. Confidence Calibration Bins (ocr_confidence_calibrations)
-- 3. Error Root Causes (ocr_error_root_causes)
-- 4. Dataset Distribution tracking on ocr_dataset_versions

CREATE TABLE IF NOT EXISTS ocr_ai_impact_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trial_id UUID REFERENCES ocr_multiline_trials(trial_id) ON DELETE CASCADE,
    trial_str_id VARCHAR(100),
    raw_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    final_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    accuracy_gain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    raw_cer DOUBLE PRECISION DEFAULT 0.0,
    final_cer DOUBLE PRECISION DEFAULT 0.0,
    raw_wer DOUBLE PRECISION DEFAULT 0.0,
    final_wer DOUBLE PRECISION DEFAULT 0.0,
    total_ocr_errors INTEGER NOT NULL DEFAULT 0,
    corrected_errors INTEGER NOT NULL DEFAULT 0,
    rescue_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_confidence_calibrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trial_id UUID REFERENCES ocr_multiline_trials(trial_id) ON DELETE CASCADE,
    confidence_range VARCHAR(30) NOT NULL,
    min_confidence DOUBLE PRECISION NOT NULL,
    max_confidence DOUBLE PRECISION NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    accuracy DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_error_root_causes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trial_id UUID REFERENCES ocr_multiline_trials(trial_id) ON DELETE CASCADE,
    line_id VARCHAR(100),
    error_type VARCHAR(100) NOT NULL,
    root_cause VARCHAR(100) NOT NULL,
    cause_description TEXT,
    severity VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extend ocr_dataset_versions with distribution columns
ALTER TABLE ocr_dataset_versions ADD COLUMN IF NOT EXISTS grade_distribution TEXT;
ALTER TABLE ocr_dataset_versions ADD COLUMN IF NOT EXISTS writing_characteristics TEXT;
ALTER TABLE ocr_dataset_versions ADD COLUMN IF NOT EXISTS image_quality_distribution TEXT;
