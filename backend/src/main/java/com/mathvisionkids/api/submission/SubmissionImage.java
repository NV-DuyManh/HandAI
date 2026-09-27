package com.mathvisionkids.api.submission;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submission_images")
@Getter
@Setter
@NoArgsConstructor
public class SubmissionImage {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID imageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @Column(nullable = false, length = 512)
    private String filePath;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Column(length = 50)
    private String source;

    @Column(updatable = false)
    private Instant createdAt = Instant.now();
}
