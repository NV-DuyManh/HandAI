package com.mathvisionkids.api.assignment;

import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.user.Teacher;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "assignments")
@Getter
@Setter
@NoArgsConstructor
public class Assignment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID assignmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String operationType;

    @Column(nullable = false)
    private Integer maxScore;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(updatable = false)
    private Instant createdAt = Instant.now();
}
