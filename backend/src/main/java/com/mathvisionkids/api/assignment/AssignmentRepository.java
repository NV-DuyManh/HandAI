package com.mathvisionkids.api.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {
    List<Assignment> findByTeacher_Id(UUID teacherId);
    List<Assignment> findByClassroom_ClassId(UUID classId);
}
