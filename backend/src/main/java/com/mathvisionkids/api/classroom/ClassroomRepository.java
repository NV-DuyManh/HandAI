package com.mathvisionkids.api.classroom;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ClassroomRepository extends JpaRepository<Classroom, UUID> {
    List<Classroom> findByTeacher_Id(UUID teacherId);
    List<Classroom> findByStudents_Id(UUID studentId);
}
