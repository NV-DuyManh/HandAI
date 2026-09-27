package com.mathvisionkids.api.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.batch.Batch;
import com.mathvisionkids.api.batch.BatchRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.mathvisionkids.api.analysis.AnalysisResult;
import com.mathvisionkids.api.analysis.AnalysisResultRepository;
import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
public class SubmissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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

    @Autowired
    private AnalysisResultRepository analysisResultRepository;

    private Teacher teacherA;
    private Teacher teacherB;
    private Student studentA;
    private Student studentB;
    private Submission submissionA;

    @BeforeEach
    public void setup() throws Exception {

        teacherA = new Teacher();
        teacherA.setEmail("teachera@test.com");
        teacherA.setPasswordHash("pass");
        teacherA.setRole("TEACHER");
        teacherA.setDisplayName("Teacher A");
        teacherA = teacherRepository.save(teacherA);

        teacherB = new Teacher();
        teacherB.setEmail("teacherb@test.com");
        teacherB.setPasswordHash("pass");
        teacherB.setRole("TEACHER");
        teacherB.setDisplayName("Teacher B");
        teacherB = teacherRepository.save(teacherB);

        studentA = new Student();
        studentA.setEmail("studenta@test.com");
        studentA.setPasswordHash("pass");
        studentA.setRole("STUDENT");
        studentA.setGradeLevel(3);
        studentA.setDisplayName("Student A");
        studentA = studentRepository.save(studentA);

        studentB = new Student();
        studentB.setEmail("studentb@test.com");
        studentB.setPasswordHash("pass");
        studentB.setRole("STUDENT");
        studentB.setGradeLevel(3);
        studentB.setDisplayName("Student B");
        studentB = studentRepository.save(studentB);

        Classroom classroom = new Classroom();
        classroom.setName("Math 101");
        classroom.setGradeLevel(3);
        classroom.setTeacher(teacherA);
        classroom.getStudents().add(studentA);
        classroom = classroomRepository.save(classroom);

        Assignment assignment = new Assignment();
        assignment.setTitle("Homework 1");
        assignment.setOperationType("ADDITION");
        assignment.setTeacher(teacherA);
        assignment.setClassroom(classroom);
        assignment.setMaxScore(100);
        assignment = assignmentRepository.save(assignment);

        Batch batch = new Batch();
        batch.setTeacher(teacherA);
        batch.setAssignment(assignment);
        batch.setStatus("CREATED");
        batch = batchRepository.save(batch);

        submissionA = new Submission();
        submissionA.setBatch(batch);
        submissionA.setAssignment(assignment);
        submissionA.setStudent(studentA);
        submissionA.setStatus("PROPOSED_GRADE");
        submissionA = submissionRepository.save(submissionA);
    }

    @Test
    @WithMockUser(username = "teachera@test.com", roles = "TEACHER")
    public void testApproveSubmission() throws Exception {
        mockMvc.perform(post("/api/v1/teacher/submissions/" + submissionA.getSubmissionId() + "/approve")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "teacherb@test.com", roles = "TEACHER")
    public void testApproveSubmissionUnauthorizedTeacher() throws Exception {
        mockMvc.perform(post("/api/v1/teacher/submissions/" + submissionA.getSubmissionId() + "/approve")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teachera@test.com", roles = "TEACHER")
    public void testOverrideSubmission() throws Exception {
        Map<String, Object> overrideData = new HashMap<>();
        overrideData.put("finalScore", 85);
        overrideData.put("reason", "Missed negative sign");

        mockMvc.perform(post("/api/v1/teacher/submissions/" + submissionA.getSubmissionId() + "/override")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overrideData)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "teachera@test.com", roles = "TEACHER")
    public void testOverrideSubmissionDecimalScore() throws Exception {
        Map<String, Object> overrideData = new HashMap<>();
        overrideData.put("score", 8.5);
        overrideData.put("reason", "Partial credit for column addition steps");

        mockMvc.perform(post("/api/v1/teacher/submissions/" + submissionA.getSubmissionId() + "/override")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overrideData)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "studentb@test.com", roles = "STUDENT")
    public void testStudentAccessingOtherStudentSubmission() throws Exception {
        mockMvc.perform(get("/api/v1/student/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "studenta@test.com", roles = "STUDENT")
    public void testStudentAccessingOwnSubmission() throws Exception {
        mockMvc.perform(get("/api/v1/student/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "studenta@test.com", roles = "STUDENT")
    public void testStudentGetSubmissionWithReasonCode() throws Exception {
        submissionA.setStatus("REVIEW_REQUIRED");
        submissionRepository.save(submissionA);

        AnalysisResult ar = new AnalysisResult();
        ar.setSubmission(submissionA);
        ar.setStatus("REVIEW_REQUIRED");
        Map<String, Object> reasons = new HashMap<>();
        reasons.put("reasonCode", "INVALID_LAYOUT");
        ar.setReviewReasons(reasons);
        analysisResultRepository.save(ar);

        mockMvc.perform(get("/api/v1/student/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value("REVIEW_REQUIRED"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.reasonCode").value("INVALID_LAYOUT"));
    }

    @Test
    @WithMockUser(username = "studenta@test.com", roles = "STUDENT")
    public void testStudentGetSubmissionWithDiagnostics() throws Exception {
        submissionA.setStatus("REVIEW_REQUIRED");
        submissionRepository.save(submissionA);

        AnalysisResult ar = new AnalysisResult();
        ar.setSubmission(submissionA);
        ar.setStatus("REVIEW_REQUIRED");
        Map<String, Object> reasons = new HashMap<>();
        reasons.put("reasonCode", "DETECTOR_NO_TOKENS");
        Map<String, Object> diags = new HashMap<>();
        diags.put("detectorInvoked", true);
        diags.put("detectorTokenCount", 0);
        diags.put("ocrInvoked", false);
        reasons.put("diagnostics", diags);
        ar.setReviewReasons(reasons);
        analysisResultRepository.save(ar);

        mockMvc.perform(get("/api/v1/student/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value("REVIEW_REQUIRED"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.reasonCode").value("DETECTOR_NO_TOKENS"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diagnostics.detectorInvoked").value(true))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diagnostics.detectorTokenCount").value(0))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diagnostics.ocrInvoked").value(false));
    }

    @Test
    @WithMockUser(username = "teachera@test.com", roles = "TEACHER")
    public void testTeacherGetSubmission() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.submissionId").value(submissionA.getSubmissionId().toString()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status").value("PROPOSED_GRADE"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.studentId").value(studentA.getId().toString()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.assignmentId").value(submissionA.getAssignment().getAssignmentId().toString()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.batchId").value(submissionA.getBatch().getBatchId().toString()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.student").doesNotExist())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    @WithMockUser(username = "teacherb@test.com", roles = "TEACHER")
    public void testTeacherGetSubmissionUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/submissions/" + submissionA.getSubmissionId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
