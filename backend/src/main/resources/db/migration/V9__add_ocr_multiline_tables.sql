-- V9: Multi-Line OCR Trial and Line Feedback Tables
CREATE TABLE IF NOT EXISTS ocr_multiline_trials (
    trial_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'CAMERA',
    page_image_object_key VARCHAR(512) NOT NULL,
    page_image_sha256 VARCHAR(64) NOT NULL,
    page_width INTEGER,
    page_height INTEGER,
    privacy_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'PHYSICAL_USER',
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_multiline_lines (
    line_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trial_id UUID NOT NULL REFERENCES ocr_multiline_trials(trial_id) ON DELETE CASCADE,
    line_order INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    line_image_object_key VARCHAR(512) NOT NULL,
    line_image_sha256 VARCHAR(64) NOT NULL,
    predicted_text TEXT NOT NULL,
    verified_text_raw TEXT,
    verified_text_normalized TEXT,
    verdict VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    training_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    model_name VARCHAR(255) DEFAULT 'Vietnamese-Handwriting-OCR-Full',
    model_version VARCHAR(50) DEFAULT '1.0.0',
    checkpoint_sha256 VARCHAR(64),
    vocab_sha256 VARCHAR(64),
    preprocessing_version VARCHAR(50) DEFAULT 'v1_resize_64x1024_imagenet',
    feedback_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_multiline_trials_created_at ON ocr_multiline_trials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_trials_is_test_data ON ocr_multiline_trials(is_test_data);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_lines_trial_order ON ocr_multiline_lines(trial_id, line_order);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_lines_training_eligible ON ocr_multiline_lines(training_eligible);
CREATE INDEX IF NOT EXISTS idx_ocr_multiline_lines_verdict ON ocr_multiline_lines(verdict);
