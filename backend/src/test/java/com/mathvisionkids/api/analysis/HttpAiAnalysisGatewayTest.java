package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.batch.Batch;
import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionImageRepository;
import com.mathvisionkids.api.submission.SubmissionRepository;
import com.mathvisionkids.api.user.Teacher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class HttpAiAnalysisGatewayTest {

    private SubmissionRepository submissionRepository;
    private AiJobRepository aiJobRepository;
    private SubmissionImageRepository submissionImageRepository;
    private RestTemplate restTemplate;
    private HttpAiAnalysisGateway gateway;

    private static final String AI_SERVICE_URL = "http://localhost:8000/internal/v1/jobs";

    @BeforeEach
    public void setup() {
        submissionRepository = mock(SubmissionRepository.class);
        aiJobRepository = mock(AiJobRepository.class);
        submissionImageRepository = mock(SubmissionImageRepository.class);
        restTemplate = mock(RestTemplate.class);

        gateway = new HttpAiAnalysisGateway(
                submissionRepository,
                aiJobRepository,
                submissionImageRepository,
                AI_SERVICE_URL,
                restTemplate
        );

        // Mock aiJobRepository.save to assign a UUID and return the saved job
        when(aiJobRepository.save(any(AiJob.class))).thenAnswer(invocation -> {
            AiJob job = invocation.getArgument(0);
            if (job.getJobId() == null) {
                job.setJobId(UUID.randomUUID());
            }
            return job;
        });
    }

    @Test
    public void testAcceptedResponseSetsJobQueued() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        submission.setStatus("PROCESSING");
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of("status", "QUEUED"), HttpStatus.OK));

        gateway.analyze(submissionId);

        ArgumentCaptor<AiJob> jobCaptor = ArgumentCaptor.forClass(AiJob.class);
        verify(aiJobRepository, times(2)).save(jobCaptor.capture());
        AiJob finalSavedJob = jobCaptor.getAllValues().get(1);
        assertEquals("QUEUED", finalSavedJob.getStatus());
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testCorrectJobIdAndSubmissionIdSent() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        submission.setStatus("PROCESSING");
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of("status", "QUEUED"), HttpStatus.OK));

        gateway.analyze(submissionId);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(eq(AI_SERVICE_URL), entityCaptor.capture(), eq(Map.class));

        Map<String, Object> body = entityCaptor.getValue().getBody();
        assertNotNull(body);
        assertEquals(submissionId.toString(), body.get("submissionId"));
        assertNotNull(body.get("jobId"), "jobId must be present in request body");
        // Verify jobId matches the created job
        ArgumentCaptor<AiJob> jobCaptor = ArgumentCaptor.forClass(AiJob.class);
        verify(aiJobRepository, times(2)).save(jobCaptor.capture());
        assertEquals(jobCaptor.getAllValues().get(0).getJobId().toString(), body.get("jobId"));
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testStudentPolicyModeSentForStudentSubmission() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        submission.setStatus("PROCESSING");
        // No batch -> Student flow
        submission.setBatch(null);
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of("status", "QUEUED"), HttpStatus.OK));

        gateway.analyze(submissionId);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(eq(AI_SERVICE_URL), entityCaptor.capture(), eq(Map.class));

        Map<String, Object> body = entityCaptor.getValue().getBody();
        assertNotNull(body);
        assertEquals("STUDENT", body.get("policyMode"), "Student submission must send policyMode=STUDENT");
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testTeacherPolicyModeSentForTeacherBatchSubmission() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        submission.setStatus("PROCESSING");

        Batch batch = new Batch();
        Teacher teacher = new Teacher();
        batch.setTeacher(teacher);
        submission.setBatch(batch);

        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of("status", "QUEUED"), HttpStatus.OK));

        gateway.analyze(submissionId);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(eq(AI_SERVICE_URL), entityCaptor.capture(), eq(Map.class));

        Map<String, Object> body = entityCaptor.getValue().getBody();
        assertNotNull(body);
        assertEquals("TEACHER", body.get("policyMode"), "Teacher batch submission must send policyMode=TEACHER");
    }

    @Test
    public void testTimeoutSetsJobFailed() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new ResourceAccessException("Read timed out"));

        gateway.analyze(submissionId);

        ArgumentCaptor<AiJob> jobCaptor = ArgumentCaptor.forClass(AiJob.class);
        verify(aiJobRepository, times(2)).save(jobCaptor.capture());
        AiJob finalSavedJob = jobCaptor.getAllValues().get(1);
        assertEquals("FAILED", finalSavedJob.getStatus(), "Timeout must set AiJob status to FAILED");
    }

    @Test
    public void testFastApiUnavailableSetsJobFailed() {
        UUID submissionId = UUID.randomUUID();
        Submission submission = new Submission();
        submission.setSubmissionId(submissionId);
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(submissionImageRepository.findBySubmission_SubmissionId(submissionId)).thenReturn(Optional.empty());

        when(restTemplate.postForEntity(eq(AI_SERVICE_URL), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE, "Service Unavailable"));

        gateway.analyze(submissionId);

        ArgumentCaptor<AiJob> jobCaptor = ArgumentCaptor.forClass(AiJob.class);
        verify(aiJobRepository, times(2)).save(jobCaptor.capture());
        AiJob finalSavedJob = jobCaptor.getAllValues().get(1);
        assertEquals("FAILED", finalSavedJob.getStatus(), "FastAPI 503 must set AiJob status to FAILED");
    }

    @Test
    public void testGatewayConfigStubMode() {
        AiGatewayConfig config = new AiGatewayConfig();
        AiAnalysisGateway stubGateway = config.stubAiAnalysisGateway(
                submissionRepository, mock(AnalysisResultRepository.class),
                mock(com.mathvisionkids.api.audit.AuditEventRepository.class), aiJobRepository
        );
        assertNotNull(stubGateway);
        assertTrue(stubGateway instanceof StubAiAnalysisGateway);
    }

    @Test
    public void testGatewayConfigFastApiMode() {
        AiGatewayConfig config = new AiGatewayConfig();
        AiAnalysisGateway httpGateway = config.httpAiAnalysisGateway(
                submissionRepository, aiJobRepository, submissionImageRepository, AI_SERVICE_URL
        );
        assertNotNull(httpGateway);
        assertTrue(httpGateway instanceof HttpAiAnalysisGateway);
    }
}
