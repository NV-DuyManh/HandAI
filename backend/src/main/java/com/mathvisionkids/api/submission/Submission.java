package com.mathvisionkids.api.submission;

import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.batch.Batch;
import com.mathvisionkids.api.user.Student;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submissions")
@Getter
@Setter
@NoArgsConstructor
public class Submission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID submissionId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private Assignment assignment;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private Batch batch;

    @Column(nullable = false)
    private String status;

    @Column(updatable = false)
    private Instant createdAt = Instant.now();

    @com.fasterxml.jackson.annotation.JsonProperty("studentId")
    public UUID getStudentId() {
        return student != null ? student.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("assignmentId")
    public UUID getAssignmentId() {
        return assignment != null ? assignment.getAssignmentId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("batchId")
    public UUID getBatchId() {
        return batch != null ? batch.getBatchId() : null;
    }
}
