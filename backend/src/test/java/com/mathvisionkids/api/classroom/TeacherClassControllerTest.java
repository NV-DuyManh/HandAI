package com.mathvisionkids.api.classroom;

import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TeacherClassControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    private Teacher teacher;
    private Classroom classroom;
    private Student student;

    @BeforeEach
    public void setup() {
        teacher = new Teacher();
        teacher.setEmail("class_teacher2@test.com");
        teacher.setPasswordHash("pass");
        teacher.setRole("TEACHER");
        teacher.setDisplayName("Class Teacher");
        teacher = teacherRepository.save(teacher);

        student = new Student();
        student.setEmail("class_student2@test.com");
        student.setPasswordHash("pass");
        student.setRole("STUDENT");
        student.setGradeLevel(3);
        student.setDisplayName("Class Student");
        student = studentRepository.save(student);

        classroom = new Classroom();
        classroom.setName("Test Classroom");
        classroom.setGradeLevel(3);
        classroom.setTeacher(teacher);
        classroom.getStudents().add(student);
        classroom = classroomRepository.save(classroom);
    }

    @AfterEach
    public void cleanup() {
        classroom.getStudents().clear();
        classroomRepository.save(classroom);
        classroomRepository.delete(classroom);
        studentRepository.delete(student);
        teacherRepository.delete(teacher);
    }

    @Test
    @WithMockUser(username = "class_teacher2@test.com", roles = "TEACHER")
    public void testGetClassroomReturnsStudentsWithoutLazyInitException() throws Exception {
        // Without @Transactional on the test, the controller MUST have its own transaction
        // (e.g. @Transactional(readOnly = true)) to avoid LazyInitializationException
        // when mapping Classroom.students.
        mockMvc.perform(get("/api/v1/teacher/classes/" + classroom.getClassId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Classroom"))
                .andExpect(jsonPath("$.students").isArray())
                .andExpect(jsonPath("$.students[0].email").value("class_student2@test.com"));
    }
}
