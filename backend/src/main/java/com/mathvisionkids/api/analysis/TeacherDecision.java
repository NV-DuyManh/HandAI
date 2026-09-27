package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.user.Teacher;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "teacher_decisions")
@Getter
@Setter
@NoArgsConstructor
public class TeacherDecision {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID decisionId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false, unique = true)
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private Integer finalScore;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(updatable = false)
    private Instant createdAt = Instant.now();
}
