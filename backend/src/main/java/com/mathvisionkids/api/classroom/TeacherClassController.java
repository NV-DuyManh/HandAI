package com.mathvisionkids.api.classroom;

import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.mathvisionkids.api.user.UserResponse;
import com.mathvisionkids.api.common.ApiException;
import org.springframework.http.HttpStatus;

import java.security.Principal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/teacher/classes")
@Transactional(readOnly = true)
public class TeacherClassController {
    
    private final ClassroomRepository classroomRepository;
    private final TeacherRepository teacherRepository;

    public TeacherClassController(ClassroomRepository classroomRepository, TeacherRepository teacherRepository) {
        this.classroomRepository = classroomRepository;
        this.teacherRepository = teacherRepository;
    }

    private ClassroomResponse toResponse(Classroom classroom, boolean includeStudents) {
        ClassroomResponse response = new ClassroomResponse();
        response.setClassId(classroom.getClassId());
        response.setName(classroom.getName());
        response.setGradeLevel(classroom.getGradeLevel());
        response.setAcademicYear(classroom.getAcademicYear());

        if (includeStudents && classroom.getStudents() != null) {
            List<UserResponse> students = classroom.getStudents().stream().map(student -> {
                UserResponse ur = new UserResponse();
                ur.setUserId(student.getId());
                ur.setEmail(student.getEmail());
                ur.setDisplayName(student.getDisplayName());
                ur.setGradeLevel(student.getGradeLevel());
                return ur;
            }).collect(Collectors.toList());
            response.setStudents(students);
        }

        return response;
    }

    @GetMapping
    public ResponseEntity<List<ClassroomResponse>> getClasses(Principal principal) {
        Teacher teacher = teacherRepository.findByEmail(principal.getName()).orElseThrow();
        List<ClassroomResponse> responses = classroomRepository.findByTeacher_Id(teacher.getId())
                .stream()
                .map(c -> toResponse(c, false))
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{classId}")
    public ResponseEntity<ClassroomResponse> getClassroom(@PathVariable UUID classId, Principal principal) {
        Teacher teacher = teacherRepository.findByEmail(principal.getName()).orElseThrow();
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        if (!classroom.getTeacher().getId().equals(teacher.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized to view this classroom", HttpStatus.FORBIDDEN);
        }

        return ResponseEntity.ok(toResponse(classroom, true));
    }
}
