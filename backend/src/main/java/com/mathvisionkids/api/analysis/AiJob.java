package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.submission.Submission;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_jobs")
@Getter
@Setter
public class AiJob {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID jobId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @Column(nullable = false)
    private String status;

    @Version
    private Long version;

    @Column(updatable = false)
    private Instant submittedAt = Instant.now();

    private Instant completedAt;
}
