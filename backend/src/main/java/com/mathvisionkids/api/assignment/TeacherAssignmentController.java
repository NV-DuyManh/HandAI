package com.mathvisionkids.api.assignment;

import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.springframework.http.ResponseEntity;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.common.ApiException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/teacher/assignments")
public class TeacherAssignmentController {
    
    private final AssignmentRepository assignmentRepository;
    private final TeacherRepository teacherRepository;
    private final ClassroomRepository classroomRepository;

    public TeacherAssignmentController(AssignmentRepository assignmentRepository, TeacherRepository teacherRepository, ClassroomRepository classroomRepository) {
        this.assignmentRepository = assignmentRepository;
        this.teacherRepository = teacherRepository;
        this.classroomRepository = classroomRepository;
    }

    private AssignmentResponse toResponse(Assignment assignment) {
        AssignmentResponse response = new AssignmentResponse();
        response.setAssignmentId(assignment.getAssignmentId());
        response.setClassId(assignment.getClassroom().getClassId());
        response.setTitle(assignment.getTitle());
        response.setOperationType(assignment.getOperationType());
        response.setMaxScore(assignment.getMaxScore());
        response.setStatus(assignment.getStatus());
        response.setCreatedAt(assignment.getCreatedAt());
        return response;
    }

    @GetMapping
    public ResponseEntity<List<AssignmentResponse>> getAssignments(Principal principal) {
        Teacher teacher = teacherRepository.findByEmail(principal.getName()).orElseThrow();
        List<AssignmentResponse> responses = assignmentRepository.findByTeacher_Id(teacher.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{assignmentId}")
    public ResponseEntity<AssignmentResponse> getAssignment(@PathVariable UUID assignmentId, Principal principal) {
        Teacher teacher = teacherRepository.findByEmail(principal.getName()).orElseThrow();
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Assignment not found", HttpStatus.NOT_FOUND));

        if (!assignment.getTeacher().getId().equals(teacher.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized", HttpStatus.FORBIDDEN);
        }

        return ResponseEntity.ok(toResponse(assignment));
    }

    @PostMapping
    public ResponseEntity<AssignmentResponse> createAssignment(@Valid @RequestBody AssignmentRequest request, Principal principal) {
        Teacher teacher = teacherRepository.findByEmail(principal.getName()).orElseThrow();
        Classroom classroom = classroomRepository.findById(request.getClassId())
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        if (!classroom.getTeacher().getId().equals(teacher.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized for this classroom", HttpStatus.FORBIDDEN);
        }

        Assignment assignment = new Assignment();
        assignment.setTeacher(teacher);
        assignment.setClassroom(classroom);
        assignment.setTitle(request.getTitle());
        assignment.setOperationType(request.getOperationType());
        assignment.setMaxScore(request.getMaxScore());
        assignment.setStatus("ACTIVE");

        assignment = assignmentRepository.save(assignment);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(assignment));
    }
}
