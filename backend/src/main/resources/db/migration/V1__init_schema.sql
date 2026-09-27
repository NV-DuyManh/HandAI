CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE students (
    student_id UUID PRIMARY KEY REFERENCES users(id),
    grade_level INTEGER NOT NULL
);

-- Teachers
CREATE TABLE teachers (
    teacher_id UUID PRIMARY KEY REFERENCES users(id)
);

-- Classrooms
CREATE TABLE classrooms (
    class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    grade_level INTEGER NOT NULL,
    teacher_id UUID NOT NULL REFERENCES teachers(teacher_id),
    academic_year VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Classroom Students
CREATE TABLE classroom_students (
    class_id UUID REFERENCES classrooms(class_id),
    student_id UUID REFERENCES students(student_id),
    PRIMARY KEY (class_id, student_id)
);

-- Assignments
CREATE TABLE assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classrooms(class_id),
    teacher_id UUID NOT NULL REFERENCES teachers(teacher_id),
    title VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    max_score INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batches
CREATE TABLE batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(assignment_id),
    teacher_id UUID NOT NULL REFERENCES teachers(teacher_id),
    status VARCHAR(50) NOT NULL,
    total_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    review_required_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Submissions
CREATE TABLE submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(student_id),
    assignment_id UUID REFERENCES assignments(assignment_id),
    batch_id UUID REFERENCES batches(batch_id),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Submission Images
CREATE TABLE submission_images (
    image_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(submission_id),
    file_path VARCHAR(512) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analysis Results
CREATE TABLE analysis_results (
    analysis_result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL UNIQUE REFERENCES submissions(submission_id),
    status VARCHAR(50) NOT NULL,
    recognized_exercise JSONB,
    validation JSONB,
    confidence DOUBLE PRECISION,
    evidence JSONB,
    student_feedback JSONB,
    review_reasons JSONB,
    grade_proposal JSONB,
    model_version VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teacher Decisions
CREATE TABLE teacher_decisions (
    decision_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL UNIQUE REFERENCES submissions(submission_id),
    teacher_id UUID NOT NULL REFERENCES teachers(teacher_id),
    type VARCHAR(50) NOT NULL,
    final_score INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Events
CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(submission_id),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sub_status ON submissions(status);
CREATE INDEX idx_sub_batch_id ON submissions(batch_id);
CREATE INDEX idx_sub_student_id ON submissions(student_id);
CREATE INDEX idx_batch_teacher_id ON batches(teacher_id);
CREATE INDEX idx_class_teacher_id ON classrooms(teacher_id);
CREATE INDEX idx_assign_teacher_id ON assignments(teacher_id);
