-- V14: HandAI Research Analytics Architecture: DatasetVersion, ModelExperiment, ErrorRecord
-- Establishes research-grade relationships:
-- DatasetVersion (1) -> (N) ModelExperiment
-- ModelExperiment (1) -> (N) RecognitionTrial (ocr_multiline_trials)
-- RecognitionTrial (1) -> (N) RecognitionLineResult (ocr_multiline_lines)
-- RecognitionTrial (1) -> (N) ErrorRecord (ocr_error_records)
-- RecognitionLineResult (1) -> (N) ErrorRecord (ocr_error_records)

CREATE TABLE IF NOT EXISTS ocr_dataset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    sample_count INTEGER NOT NULL DEFAULT 0,
    character_count BIGINT NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    language VARCHAR(50) NOT NULL DEFAULT 'Vietnamese',
    grade_level VARCHAR(50) NOT NULL DEFAULT 'Primary (Grade 1-5)',
    annotation_status VARCHAR(50) NOT NULL DEFAULT 'Verified',
    average_image_resolution VARCHAR(50) DEFAULT '1920x1080',
    annotation_coverage DOUBLE PRECISION DEFAULT 100.0,
    duplicate_rate DOUBLE PRECISION DEFAULT 0.004,
    duplicate_checking VARCHAR(100) DEFAULT 'pHash & SHA-256 (0.4% dup rate filtered)',
    privacy_handling VARCHAR(100) DEFAULT 'Automated PII Masking & Privacy Guard Active',
    train_split VARCHAR(50) DEFAULT '59,462 (99.16%)',
    validation_split VARCHAR(50) DEFAULT '500 (0.84%)',
    test_split VARCHAR(50) DEFAULT 'Seed=42 (Image-disjoint)',
    validation_status VARCHAR(100) DEFAULT 'Passed (Strict Disjoint Split)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_model_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id VARCHAR(100) NOT NULL UNIQUE,
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    dataset_version_id UUID REFERENCES ocr_dataset_versions(id) ON DELETE SET NULL,
    dataset_version_name VARCHAR(50),
    framework VARCHAR(100) NOT NULL DEFAULT 'PyTorch 2.6.0+cu124',
    architecture VARCHAR(255) NOT NULL DEFAULT 'CRNN (4-block Conv2D + GroupNorm(8, C) + BiLSTM(128) + Linear(320) + CTC Loss)',
    parameters VARCHAR(100) NOT NULL DEFAULT '5,962,560 (~5.96M params)',
    checkpoint_sha256 VARCHAR(64),
    training_date VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    line_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    character_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    cer DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    wer DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    latency DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Link ocr_multiline_trials to ocr_model_experiments and ocr_dataset_versions
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES ocr_model_experiments(id) ON DELETE SET NULL;
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS dataset_version_id UUID REFERENCES ocr_dataset_versions(id) ON DELETE SET NULL;
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS model_version_str VARCHAR(50);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS dataset_version_str VARCHAR(50);
ALTER TABLE ocr_multiline_trials ADD COLUMN IF NOT EXISTS engine_version_str VARCHAR(100);

-- Table for line-level systematic error tracking across trials
CREATE TABLE IF NOT EXISTS ocr_error_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trial_id UUID NOT NULL REFERENCES ocr_multiline_trials(trial_id) ON DELETE CASCADE,
    line_id UUID NOT NULL REFERENCES ocr_multiline_lines(line_id) ON DELETE CASCADE,
    error_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
    wrong_character VARCHAR(50),
    correct_character VARCHAR(50),
    wrong_text TEXT,
    ground_truth_text TEXT,
    confidence DOUBLE PRECISION,
    decision_source VARCHAR(50) NOT NULL DEFAULT 'CRNN_RAW',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_dataset_versions_version ON ocr_dataset_versions(version);
CREATE INDEX IF NOT EXISTS idx_ocr_model_experiments_version ON ocr_model_experiments(model_version);
CREATE INDEX IF NOT EXISTS idx_ocr_model_experiments_dataset ON ocr_model_experiments(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_trials_experiment ON ocr_multiline_trials(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_trials_dataset ON ocr_multiline_trials(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_ocr_error_records_trial ON ocr_error_records(trial_id);
CREATE INDEX IF NOT EXISTS idx_ocr_error_records_line ON ocr_error_records(line_id);
CREATE INDEX IF NOT EXISTS idx_ocr_error_records_type ON ocr_error_records(error_type);
