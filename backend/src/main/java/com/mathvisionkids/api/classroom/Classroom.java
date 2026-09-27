package com.mathvisionkids.api.classroom;

import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.Teacher;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "classrooms")
@Getter
@Setter
@NoArgsConstructor
public class Classroom {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID classId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer gradeLevel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    private String academicYear;

    @Column(updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "classroom_students",
        joinColumns = @JoinColumn(name = "class_id"),
        inverseJoinColumns = @JoinColumn(name = "student_id")
    )
    private Set<Student> students = new java.util.HashSet<>();
}
