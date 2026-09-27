-- V6: OCR Pilot Trials & Human Feedback Dataset Loop
CREATE TABLE ocr_trials (
    trial_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    source VARCHAR(50) NOT NULL,
    line_image_object_key VARCHAR(512) NOT NULL,
    line_image_sha256 VARCHAR(64) NOT NULL,
    image_width INTEGER,
    image_height INTEGER,
    predicted_text TEXT,
    verified_text_raw TEXT,
    verdict VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    checkpoint_sha256 VARCHAR(64) NOT NULL,
    vocab_sha256 VARCHAR(64) NOT NULL,
    preprocessing_version VARCHAR(50) NOT NULL DEFAULT 'v1_resize_64x1024_imagenet',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    feedback_at TIMESTAMP WITH TIME ZONE,
    training_eligible BOOLEAN NOT NULL DEFAULT false,
    privacy_confirmed BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ocr_trials_user_id ON ocr_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_trials_verdict ON ocr_trials(verdict);
CREATE INDEX IF NOT EXISTS idx_ocr_trials_training_eligible ON ocr_trials(training_eligible);
CREATE INDEX IF NOT EXISTS idx_ocr_trials_created_at ON ocr_trials(created_at DESC);
