package com.mathvisionkids.api.dashboard;

import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.batch.Batch;
import com.mathvisionkids.api.batch.BatchRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionRepository;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class TeacherDashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    private Teacher teacherA;
    private Teacher teacherB;

    @BeforeEach
    public void setup() {
        teacherA = new Teacher();
        teacherA.setEmail("dashteachera@test.com");
        teacherA.setPasswordHash("pass");
        teacherA.setRole("TEACHER");
        teacherA.setDisplayName("Dashboard Teacher A");
        teacherA = teacherRepository.save(teacherA);

        teacherB = new Teacher();
        teacherB.setEmail("dashteacherb@test.com");
        teacherB.setPasswordHash("pass");
        teacherB.setRole("TEACHER");
        teacherB.setDisplayName("Dashboard Teacher B");
        teacherB = teacherRepository.save(teacherB);

        Student student = new Student();
        student.setEmail("dashstudent@test.com");
        student.setPasswordHash("pass");
        student.setRole("STUDENT");
        student.setGradeLevel(3);
        student.setDisplayName("Dashboard Student");
        student = studentRepository.save(student);

        Classroom classroom = new Classroom();
        classroom.setName("Dashboard Class");
        classroom.setGradeLevel(3);
        classroom.setTeacher(teacherA);
        classroom.getStudents().add(student);
        classroom = classroomRepository.save(classroom);

        Assignment assignment = new Assignment();
        assignment.setTitle("Dashboard Assignment");
        assignment.setOperationType("ADDITION");
        assignment.setTeacher(teacherA);
        assignment.setClassroom(classroom);
        assignment.setMaxScore(100);
        assignment = assignmentRepository.save(assignment);

        Batch batch = new Batch();
        batch.setTeacher(teacherA);
        batch.setAssignment(assignment);
        batch.setStatus("PROCESSING");
        batch.setTotalCount(2);
        batch = batchRepository.save(batch);

        Submission sub1 = new Submission();
        sub1.setBatch(batch);
        sub1.setAssignment(assignment);
        sub1.setStudent(student);
        sub1.setStatus("PROPOSED_GRADE");
        submissionRepository.save(sub1);

        Submission sub2 = new Submission();
        sub2.setBatch(batch);
        sub2.setAssignment(assignment);
        sub2.setStudent(student);
        sub2.setStatus("TEACHER_APPROVED");
        submissionRepository.save(sub2);
    }

    @Test
    @WithMockUser(username = "dashteachera@test.com", roles = "TEACHER")
    public void testTeacherReceivesOwnDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.processedCount").value(1))
                .andExpect(jsonPath("$.reviewRequiredCount").value(1))
                .andExpect(jsonPath("$.recentBatches").isArray())
                .andExpect(jsonPath("$.recentBatches[0].status").value("PROCESSING"));
    }

    @Test
    @WithMockUser(username = "dashteacherb@test.com", roles = "TEACHER")
    public void testTeacherBDoesNotSeeTeacherAData() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.processedCount").value(0))
                .andExpect(jsonPath("$.reviewRequiredCount").value(0))
                .andExpect(jsonPath("$.recentBatches").isEmpty());
    }

    @Test
    @WithMockUser(username = "dashstudent@test.com", roles = "STUDENT")
    public void testStudentCannotAccessDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/dashboard"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "emptyteacher@test.com", roles = "TEACHER")
    public void testEmptyDashboard() throws Exception {
        Teacher emptyTeacher = new Teacher();
        emptyTeacher.setEmail("emptyteacher@test.com");
        emptyTeacher.setPasswordHash("pass");
        emptyTeacher.setRole("TEACHER");
        emptyTeacher.setDisplayName("Empty Teacher");
        teacherRepository.save(emptyTeacher);

        mockMvc.perform(get("/api/v1/teacher/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotal").value(0))
                .andExpect(jsonPath("$.processedCount").value(0))
                .andExpect(jsonPath("$.reviewRequiredCount").value(0))
                .andExpect(jsonPath("$.recentBatches").isEmpty());
    }
}
