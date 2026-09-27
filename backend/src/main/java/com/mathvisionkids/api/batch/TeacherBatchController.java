package com.mathvisionkids.api.batch;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher/batches")
public class TeacherBatchController {

    private final BatchService batchService;
    private final ObjectMapper objectMapper;

    public TeacherBatchController(BatchService batchService, ObjectMapper objectMapper) {
        this.batchService = batchService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public ResponseEntity<Batch> createBatch(@RequestBody Map<String, String> request, Principal principal) {
        UUID assignmentId = UUID.fromString(request.get("assignmentId"));
        Batch batch = batchService.createBatch(principal.getName(), assignmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(batch);
    }

    @PostMapping("/{batchId}/submissions")
    public ResponseEntity<Void> uploadImages(@PathVariable UUID batchId, 
                                             @RequestParam(value = "images", required = false) List<MultipartFile> images, 
                                             @RequestParam("manifest") String manifestJson,
                                             Principal principal) {
        if (images == null || images.isEmpty()) {
            throw new com.mathvisionkids.api.common.ApiException("VALIDATION_ERROR", "Image count must be between 1 and 30", HttpStatus.BAD_REQUEST);
        }
        try {
            List<BatchImageMapping> mappings = objectMapper.readValue(manifestJson, new TypeReference<List<BatchImageMapping>>(){});
            batchService.uploadImages(principal.getName(), batchId, images, mappings);
            return ResponseEntity.status(HttpStatus.ACCEPTED).build();
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new com.mathvisionkids.api.common.ApiException("BAD_REQUEST", "Invalid manifest json", HttpStatus.BAD_REQUEST);
        }
    }
    
    @GetMapping
    public ResponseEntity<List<Batch>> getBatches(Principal principal) {
        return ResponseEntity.ok(batchService.getBatches(principal.getName()));
    }

    @GetMapping("/{batchId}")
    public ResponseEntity<Batch> getBatch(@PathVariable UUID batchId, Principal principal) {
        return ResponseEntity.ok(batchService.getBatch(principal.getName(), batchId));
    }

    @GetMapping("/{batchId}/review")
    public ResponseEntity<List<UUID>> getBatchReviewQueue(@PathVariable UUID batchId, Principal principal) {
        return ResponseEntity.ok(batchService.getBatchReviewQueue(principal.getName(), batchId));
    }
}
