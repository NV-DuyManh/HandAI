package com.mathvisionkids.api.admin;

import com.mathvisionkids.api.admin.dto.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    // ==========================================
    // USER PROVISIONING & MANAGEMENT
    // ==========================================

    @PostMapping("/users")
    public ResponseEntity<AdminUserResponse> createUser(@Valid @RequestBody CreateUserRequest request, Principal principal) {
        AdminUserResponse response = adminService.createUser(request, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/users")
    public ResponseEntity<Page<AdminUserResponse>> getUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        Page<AdminUserResponse> users = adminService.getUsers(role, active, query, 
                PageRequest.of(page, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(users);
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<AdminUserResponse> getUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(adminService.getUser(userId));
    }

    @PatchMapping("/users/{userId}")
    public ResponseEntity<AdminUserResponse> updateUser(
            @PathVariable UUID userId,
            @RequestBody UpdateUserRequest request,
            Principal principal) {
        return ResponseEntity.ok(adminService.updateUser(userId, request, principal.getName()));
    }

    @PostMapping("/users/{userId}/disable")
    public ResponseEntity<Void> disableUser(@PathVariable UUID userId, Principal principal) {
        adminService.disableUser(userId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{userId}/enable")
    public ResponseEntity<Void> enableUser(@PathVariable UUID userId, Principal principal) {
        adminService.enableUser(userId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{userId}/reset-password")
    public ResponseEntity<ResetPasswordResponse> resetPassword(
            @PathVariable UUID userId,
            @RequestBody(required = false) ResetPasswordRequest request,
            Principal principal) {
        return ResponseEntity.ok(adminService.resetPassword(userId, request, principal.getName()));
    }

    // ==========================================
    // CLASSROOM & ROSTER MANAGEMENT
    // ==========================================

    @PostMapping("/classes")
    public ResponseEntity<AdminClassResponse> createClass(
            @Valid @RequestBody CreateClassRequest request,
            Principal principal) {
        AdminClassResponse response = adminService.createClass(request, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/classes")
    public ResponseEntity<Page<AdminClassResponse>> getClasses(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        Page<AdminClassResponse> classes = adminService.getClasses(
                PageRequest.of(page, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(classes);
    }

    @GetMapping("/classes/{classId}")
    public ResponseEntity<AdminClassResponse> getClass(@PathVariable UUID classId) {
        return ResponseEntity.ok(adminService.getClass(classId));
    }

    @PatchMapping("/classes/{classId}")
    public ResponseEntity<AdminClassResponse> updateClass(
            @PathVariable UUID classId,
            @Valid @RequestBody UpdateClassRequest request,
            Principal principal) {
        return ResponseEntity.ok(adminService.updateClass(classId, request, principal.getName()));
    }

    @PutMapping("/classes/{classId}/teacher")
    public ResponseEntity<AdminClassResponse> assignTeacher(
            @PathVariable UUID classId,
            @Valid @RequestBody AssignTeacherRequest request,
            Principal principal) {
        return ResponseEntity.ok(adminService.assignTeacher(classId, request.getTeacherId(), principal.getName()));
    }

    @PostMapping("/classes/{classId}/students/{studentId}")
    public ResponseEntity<AdminClassResponse> addStudentToClass(
            @PathVariable UUID classId,
            @PathVariable UUID studentId,
            Principal principal) {
        return ResponseEntity.ok(adminService.addStudentToClass(classId, studentId, principal.getName()));
    }

    @DeleteMapping("/classes/{classId}/students/{studentId}")
    public ResponseEntity<AdminClassResponse> removeStudentFromClass(
            @PathVariable UUID classId,
            @PathVariable UUID studentId,
            Principal principal) {
        return ResponseEntity.ok(adminService.removeStudentFromClass(classId, studentId, principal.getName()));
    }

    // ==========================================
    // DASHBOARD & AUDIT
    // ==========================================

    @GetMapping("/dashboard")
    public ResponseEntity<AdminDashboardResponse> getDashboard() {
        return ResponseEntity.ok(adminService.getDashboard());
    }

    @GetMapping("/audit")
    public ResponseEntity<Page<AdminAuditEventResponse>> getAudit(
            @RequestParam(required = false) String eventType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        return ResponseEntity.ok(adminService.getAuditEvents(eventType, 
                PageRequest.of(page, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt"))));
    }
}
