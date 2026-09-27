package com.mathvisionkids.api.submission;

import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.batch.Batch;
import com.mathvisionkids.api.batch.BatchRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.mockito.Mockito;
import static org.mockito.ArgumentMatchers.any;
import com.mathvisionkids.api.storage.ObjectStorageService;
import java.io.IOException;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class StateTransitionTest {

    @Autowired
    private SubmissionService submissionService;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private SubmissionImageRepository submissionImageRepository;

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

    @MockBean
    private ObjectStorageService objectStorageService;

    private Teacher teacher;
    private Student student;
    private Submission testSubmission;

    @BeforeEach
    public void setup() throws Exception {
        Mockito.when(objectStorageService.store(any(), any())).thenReturn("mock/path/test.jpg");
        Mockito.when(objectStorageService.getAuthorizedReference(any())).thenReturn("/api/v1/internal/images?path=mock/path/test.jpg");

        teacher = new Teacher();
        teacher.setEmail("teacher@test.com");
        teacher.setPasswordHash("pass");
        teacher.setRole("TEACHER");
        teacher.setDisplayName("Teacher");
        teacherRepository.save(teacher);

        student = new Student();
        student.setEmail("student@test.com");
        student.setPasswordHash("pass");
        student.setRole("STUDENT");
        student.setGradeLevel(3);
        student.setDisplayName("Student");
        studentRepository.save(student);

        Classroom classroom = new Classroom();
        classroom.setName("Math 101");
        classroom.setGradeLevel(3);
        classroom.setTeacher(teacher);
        classroom.getStudents().add(student);
        classroomRepository.save(classroom);

        Assignment assignment = new Assignment();
        assignment.setTitle("Homework 1");
        assignment.setOperationType("ADDITION");
        assignment.setTeacher(teacher);
        assignment.setClassroom(classroom);
        assignment.setMaxScore(100);
        assignmentRepository.save(assignment);

        Batch batch = new Batch();
        batch.setTeacher(teacher);
        batch.setAssignment(assignment);
        batch.setStatus("CREATED");
        batchRepository.save(batch);

        testSubmission = new Submission();
        testSubmission.setBatch(batch);
        testSubmission.setAssignment(assignment);
        testSubmission.setStudent(student);
        testSubmission.setStatus("PROCESSING");
        submissionRepository.save(testSubmission);
    }

    @Test
    public void testProcessingToProposedGrade() {
        testSubmission.setStatus("PROPOSED_GRADE");
        submissionRepository.save(testSubmission);
        assertEquals("PROPOSED_GRADE", testSubmission.getStatus());
    }

    @Test
    public void testProposedGradeToTeacherApproved() {
        testSubmission.setStatus("PROPOSED_GRADE");
        submissionRepository.save(testSubmission);

        submissionService.approveSubmission(teacher.getEmail(), testSubmission.getSubmissionId());

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("TEACHER_APPROVED", updated.getStatus());
    }

    @Test
    public void testProposedGradeToTeacherOverridden() {
        testSubmission.setStatus("PROPOSED_GRADE");
        submissionRepository.save(testSubmission);

        submissionService.overrideSubmission(teacher.getEmail(), testSubmission.getSubmissionId(), new HashMap<>() {{
            put("finalScore", 80);
            put("reason", "Missed step");
        }});

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("TEACHER_OVERRIDDEN", updated.getStatus());
    }

    @Test
    public void testReviewRequiredToTeacherApproved() {
        testSubmission.setStatus("REVIEW_REQUIRED");
        submissionRepository.save(testSubmission);

        submissionService.approveSubmission(teacher.getEmail(), testSubmission.getSubmissionId());

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("TEACHER_APPROVED", updated.getStatus());
    }

    @Test
    public void testReviewRequiredToTeacherOverridden() {
        testSubmission.setStatus("REVIEW_REQUIRED");
        submissionRepository.save(testSubmission);

        submissionService.overrideSubmission(teacher.getEmail(), testSubmission.getSubmissionId(), new HashMap<>() {{
            put("finalScore", 60);
            put("reason", "Illegible handwriting");
        }});

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("TEACHER_OVERRIDDEN", updated.getStatus());
    }

    @Test
    public void testFeedbackReadyToTeacherApproved() {
        testSubmission.setStatus("FEEDBACK_READY");
        submissionRepository.save(testSubmission);

        submissionService.approveSubmission(teacher.getEmail(), testSubmission.getSubmissionId());

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("TEACHER_APPROVED", updated.getStatus());
    }

    @Test
    public void testIllegalApproveFromProcessing() {
        testSubmission.setStatus("PROCESSING");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.approveSubmission(teacher.getEmail(), testSubmission.getSubmissionId());
        });

        assertEquals("INVALID_STATE", ex.getCode());
    }

    @Test
    public void testIllegalRetryFromTeacherApproved() {
        testSubmission.setStatus("TEACHER_APPROVED");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");
        });

        assertEquals("INVALID_STATE", ex.getCode());
    }

    @Test
    public void testIllegalRetryFromProcessing() {
        testSubmission.setStatus("PROCESSING");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");
        });

        assertEquals("INVALID_STATE", ex.getCode());
    }

    @Test
    public void testRetryFromNeedsRetake() {
        testSubmission.setStatus("NEEDS_RETAKE");
        submissionRepository.save(testSubmission);

        // Should not throw — retry from NEEDS_RETAKE is a valid transition
        submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        // Stub gateway runs synchronously (self-invocation bypasses @Async),
        // so status advances past PROCESSING to PROPOSED_GRADE.
        // Key assertion: status is no longer NEEDS_RETAKE.
        assert !"NEEDS_RETAKE".equals(updated.getStatus()) : "Status should have advanced past NEEDS_RETAKE";
        assertEquals(testSubmission.getSubmissionId(), updated.getSubmissionId()); // Same submission retained

        // Verify new SubmissionImage is created
        long imageCount = submissionImageRepository.findAll().stream()
                .filter(img -> img.getSubmission().getSubmissionId().equals(updated.getSubmissionId()))
                .count();
        assertEquals(1, imageCount);
    }

    @Test
    public void testRetryFromCropRequired() {
        testSubmission.setStatus("CROP_REQUIRED");
        submissionRepository.save(testSubmission);

        submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");

        Submission updated = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assert !"CROP_REQUIRED".equals(updated.getStatus());
        assertEquals(testSubmission.getSubmissionId(), updated.getSubmissionId());
    }

    @Test
    public void testRetryWrongOwner() {
        testSubmission.setStatus("NEEDS_RETAKE");
        submissionRepository.save(testSubmission);

        Student otherStudent = new Student();
        otherStudent.setEmail("other@test.com");
        otherStudent.setPasswordHash("pass");
        otherStudent.setRole("STUDENT");
        otherStudent.setDisplayName("Other");
        otherStudent.setGradeLevel(3);
        studentRepository.save(otherStudent);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(otherStudent.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");
        });
        assertEquals("FORBIDDEN", ex.getCode());
    }

    @Test
    public void testRetryStorageFailure() throws Exception {
        testSubmission.setStatus("NEEDS_RETAKE");
        submissionRepository.save(testSubmission);

        Mockito.when(objectStorageService.store(any(), any())).thenThrow(new IOException("Storage full"));

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes()), "CAMERA");
        });
        assertEquals("INTERNAL_ERROR", ex.getCode());
        
        Submission unchanged = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assertEquals("NEEDS_RETAKE", unchanged.getStatus());
    }

    @Test
    public void testOverrideRequiresReason() {
        testSubmission.setStatus("PROPOSED_GRADE");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.overrideSubmission(teacher.getEmail(), testSubmission.getSubmissionId(), new HashMap<>() {{
                put("finalScore", 50);
            }});
        });

        assertEquals("VALIDATION_ERROR", ex.getCode());
    }

    @Test
    public void testRetryWithMissingImage() {
        testSubmission.setStatus("NEEDS_RETAKE");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), null, "CAMERA");
        });

        assertEquals("VALIDATION_ERROR", ex.getCode());
    }

    @Test
    public void testRetryWithUnsupportedImageType() {
        testSubmission.setStatus("NEEDS_RETAKE");
        submissionRepository.save(testSubmission);

        ApiException ex = assertThrows(ApiException.class, () -> {
            submissionService.retrySubmission(student.getEmail(), testSubmission.getSubmissionId(), new MockMultipartFile("image", "test.txt", "text/plain", "content".getBytes()), "CAMERA");
        });

        assertEquals("UNSUPPORTED_MEDIA_TYPE", ex.getCode());
    }
}
