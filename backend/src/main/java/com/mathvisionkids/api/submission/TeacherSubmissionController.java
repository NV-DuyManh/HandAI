package com.mathvisionkids.api.submission;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher/submissions")
public class TeacherSubmissionController {

    private final SubmissionService submissionService;

    public TeacherSubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @GetMapping("/{submissionId}")
    public ResponseEntity<Submission> getSubmission(@PathVariable UUID submissionId, Principal principal) {
        return ResponseEntity.ok(submissionService.getTeacherSubmission(principal.getName(), submissionId));
    }

    @PostMapping("/{submissionId}/approve")
    public ResponseEntity<Void> approveSubmission(@PathVariable UUID submissionId, Principal principal) {
        submissionService.approveSubmission(principal.getName(), submissionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{submissionId}/override")
    public ResponseEntity<Void> overrideSubmission(@PathVariable UUID submissionId, @RequestBody Map<String, Object> overrideData, Principal principal) {
        submissionService.overrideSubmission(principal.getName(), submissionId, overrideData);
        return ResponseEntity.ok().build();
    }
}
