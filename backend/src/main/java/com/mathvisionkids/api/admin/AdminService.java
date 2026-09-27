package com.mathvisionkids.api.admin;

import com.mathvisionkids.api.admin.dto.*;
import com.mathvisionkids.api.audit.AuditEvent;
import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.auth.RefreshTokenService;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.user.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final ClassroomRepository classroomRepository;
    private final AuditEventRepository auditEventRepository;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;

    public AdminService(UserRepository userRepository,
                        StudentRepository studentRepository,
                        TeacherRepository teacherRepository,
                        ClassroomRepository classroomRepository,
                        AuditEventRepository auditEventRepository,
                        RefreshTokenService refreshTokenService,
                        PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.classroomRepository = classroomRepository;
        this.auditEventRepository = auditEventRepository;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
    }

    private void recordAudit(User actor, String eventType, Map<String, Object> metadata) {
        AuditEvent event = new AuditEvent();
        event.setUser(actor);
        event.setEventType(eventType);
        event.setMetadata(metadata != null ? metadata : new HashMap<>());
        auditEventRepository.save(event);
    }

    private User getAdminActor(String adminEmail) {
        return userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ApiException("UNAUTHORIZED", "Admin user not found", HttpStatus.UNAUTHORIZED));
    }

    private AdminUserResponse mapToAdminUserResponse(User user, List<AdminClassSummary> classes) {
        Integer grade = null;
        if ("STUDENT".equals(user.getRole())) {
            grade = studentRepository.findById(user.getId()).map(Student::getGradeLevel).orElse(null);
        }
        return AdminUserResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .gradeLevel(grade)
                .active(user.getActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .classes(classes != null ? classes : Collections.emptyList())
                .build();
    }

    private AdminUserSummary mapToUserSummary(User user) {
        Integer grade = null;
        if ("STUDENT".equals(user.getRole())) {
            grade = studentRepository.findById(user.getId()).map(Student::getGradeLevel).orElse(null);
        }
        return AdminUserSummary.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .gradeLevel(grade)
                .active(user.getActive())
                .build();
    }

    private AdminClassResponse mapToClassResponse(Classroom classroom, boolean includeStudents) {
        AdminUserSummary teacherSummary = classroom.getTeacher() != null ? mapToUserSummary(classroom.getTeacher()) : null;
        int count = classroom.getStudents() != null ? classroom.getStudents().size() : 0;
        List<AdminUserSummary> students = null;
        if (includeStudents && classroom.getStudents() != null) {
            students = classroom.getStudents().stream()
                    .map(this::mapToUserSummary)
                    .collect(Collectors.toList());
        }

        return AdminClassResponse.builder()
                .classId(classroom.getClassId())
                .name(classroom.getName())
                .gradeLevel(classroom.getGradeLevel())
                .academicYear(classroom.getAcademicYear())
                .teacher(teacherSummary)
                .studentCount(count)
                .students(students)
                .createdAt(classroom.getCreatedAt())
                .build();
    }

    // ==========================================
    // USER PROVISIONING & MANAGEMENT
    // ==========================================

    @Transactional
    public AdminUserResponse createUser(CreateUserRequest request, String adminEmail) {
        User admin = getAdminActor(adminEmail);

        String rawRole = request.getRole() != null ? request.getRole().trim().toUpperCase() : "";
        if ("ADMIN".equals(rawRole)) {
            throw new ApiException("VALIDATION_ERROR", "Cannot create ADMIN user through this endpoint", HttpStatus.BAD_REQUEST);
        }
        if (!"STUDENT".equals(rawRole) && !"TEACHER".equals(rawRole)) {
            throw new ApiException("VALIDATION_ERROR", "Role must be STUDENT or TEACHER", HttpStatus.BAD_REQUEST);
        }

        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ApiException("CONFLICT", "Email already exists: " + email, HttpStatus.CONFLICT);
        }

        String displayName = request.getDisplayName().trim();
        String passwordHash = passwordEncoder.encode(request.getInitialPassword());

        User created;
        if ("STUDENT".equals(rawRole)) {
            if (request.getGradeLevel() == null || request.getGradeLevel() < 1 || request.getGradeLevel() > 5) {
                throw new ApiException("VALIDATION_ERROR", "Student gradeLevel must be between 1 and 5", HttpStatus.BAD_REQUEST);
            }
            Student student = new Student();
            student.setEmail(email);
            student.setDisplayName(displayName);
            student.setPasswordHash(passwordHash);
            student.setRole("STUDENT");
            student.setActive(true);
            student.setGradeLevel(request.getGradeLevel());
            created = studentRepository.save(student);
        } else {
            if (request.getGradeLevel() != null) {
                throw new ApiException("VALIDATION_ERROR", "Teacher must not have gradeLevel", HttpStatus.BAD_REQUEST);
            }
            Teacher teacher = new Teacher();
            teacher.setEmail(email);
            teacher.setDisplayName(displayName);
            teacher.setPasswordHash(passwordHash);
            teacher.setRole("TEACHER");
            teacher.setActive(true);
            created = teacherRepository.save(teacher);
        }

        Map<String, Object> auditMeta = new HashMap<>();
        auditMeta.put("targetUserId", created.getId().toString());
        auditMeta.put("targetEmail", created.getEmail());
        auditMeta.put("role", created.getRole());
        recordAudit(admin, "ADMIN_USER_CREATED", auditMeta);

        return mapToAdminUserResponse(created, Collections.emptyList());
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> getUsers(String role, Boolean active, String query, Pageable pageable) {
        Specification<User> spec = (root, q, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (role != null && !role.isBlank()) {
                predicates.add(cb.equal(root.get("role"), role.trim().toUpperCase()));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (query != null && !query.isBlank()) {
                String search = "%" + query.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("email")), search),
                        cb.like(cb.lower(root.get("displayName")), search)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        return userRepository.findAll(spec, pageable).map(u -> mapToAdminUserResponse(u, Collections.emptyList()));
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        List<AdminClassSummary> classes = new ArrayList<>();
        if ("STUDENT".equals(user.getRole())) {
            classes = classroomRepository.findByStudents_Id(userId).stream()
                    .map(c -> AdminClassSummary.builder()
                            .classId(c.getClassId())
                            .name(c.getName())
                            .gradeLevel(c.getGradeLevel())
                            .academicYear(c.getAcademicYear())
                            .build())
                    .collect(Collectors.toList());
        } else if ("TEACHER".equals(user.getRole())) {
            classes = classroomRepository.findByTeacher_Id(userId).stream()
                    .map(c -> AdminClassSummary.builder()
                            .classId(c.getClassId())
                            .name(c.getName())
                            .gradeLevel(c.getGradeLevel())
                            .academicYear(c.getAcademicYear())
                            .build())
                    .collect(Collectors.toList());
        }

        return mapToAdminUserResponse(user, classes);
    }

    @Transactional
    public AdminUserResponse updateUser(UUID userId, UpdateUserRequest request, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        boolean modified = false;
        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
            user.setDisplayName(request.getDisplayName().trim());
            modified = true;
        }

        if (request.getGradeLevel() != null) {
            if (!"STUDENT".equals(user.getRole())) {
                throw new ApiException("VALIDATION_ERROR", "Cannot set gradeLevel for non-student", HttpStatus.BAD_REQUEST);
            }
            if (request.getGradeLevel() < 1 || request.getGradeLevel() > 5) {
                throw new ApiException("VALIDATION_ERROR", "Grade level must be between 1 and 5", HttpStatus.BAD_REQUEST);
            }
            Student student = studentRepository.findById(userId)
                    .orElseThrow(() -> new ApiException("NOT_FOUND", "Student record not found", HttpStatus.NOT_FOUND));
            student.setGradeLevel(request.getGradeLevel());
            studentRepository.save(student);
            modified = true;
        }

        if (modified) {
            user = userRepository.save(user);
            Map<String, Object> meta = new HashMap<>();
            meta.put("targetUserId", userId.toString());
            recordAudit(admin, "ADMIN_USER_UPDATED", meta);
        }

        return getUser(userId);
    }

    @Transactional
    public void disableUser(UUID userId, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        if (admin.getId().equals(userId)) {
            throw new ApiException("BAD_REQUEST", "Admin cannot disable own account", HttpStatus.BAD_REQUEST);
        }

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        target.setActive(false);
        userRepository.save(target);

        // Revoke active refresh tokens immediately
        refreshTokenService.deleteByUserId(userId);

        Map<String, Object> meta = new HashMap<>();
        meta.put("targetUserId", userId.toString());
        meta.put("targetEmail", target.getEmail());
        recordAudit(admin, "ADMIN_USER_DISABLED", meta);
    }

    @Transactional
    public void enableUser(UUID userId, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        target.setActive(true);
        userRepository.save(target);

        Map<String, Object> meta = new HashMap<>();
        meta.put("targetUserId", userId.toString());
        meta.put("targetEmail", target.getEmail());
        recordAudit(admin, "ADMIN_USER_ENABLED", meta);
    }

    @Transactional
    public ResetPasswordResponse resetPassword(UUID userId, ResetPasswordRequest request, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        String tempPass;
        if (request != null && request.getTemporaryPassword() != null && !request.getTemporaryPassword().isBlank()) {
            tempPass = request.getTemporaryPassword();
            if (tempPass.length() < 6) {
                throw new ApiException("VALIDATION_ERROR", "Password must be at least 6 characters", HttpStatus.BAD_REQUEST);
            }
        } else {
            // Generate secure random temporary password: 8 alphanumeric characters
            String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
            SecureRandom random = new SecureRandom();
            StringBuilder sb = new StringBuilder(10);
            for (int i = 0; i < 10; i++) {
                sb.append(chars.charAt(random.nextInt(chars.length())));
            }
            tempPass = sb.toString();
        }

        target.setPasswordHash(passwordEncoder.encode(tempPass));
        userRepository.save(target);

        // Revoke all existing refresh tokens
        refreshTokenService.deleteByUserId(userId);

        Map<String, Object> meta = new HashMap<>();
        meta.put("targetUserId", userId.toString());
        meta.put("targetEmail", target.getEmail());
        // Plaintext password is NEVER stored in audit log
        recordAudit(admin, "ADMIN_USER_PASSWORD_RESET", meta);

        return ResetPasswordResponse.builder()
                .userId(target.getId())
                .email(target.getEmail())
                .temporaryPassword(tempPass)
                .message("Password successfully reset. Share this temporary password securely with the user.")
                .build();
    }

    // ==========================================
    // CLASSROOM & ROSTER MANAGEMENT
    // ==========================================

    @Transactional
    public AdminClassResponse createClass(CreateClassRequest request, String adminEmail) {
        User admin = getAdminActor(adminEmail);

        if (request.getGradeLevel() < 1 || request.getGradeLevel() > 5) {
            throw new ApiException("VALIDATION_ERROR", "Class gradeLevel must be between 1 and 5", HttpStatus.BAD_REQUEST);
        }

        User targetTeacherUser = userRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher user not found", HttpStatus.NOT_FOUND));

        if (!"TEACHER".equals(targetTeacherUser.getRole())) {
            throw new ApiException("VALIDATION_ERROR", "Assigned user must have role TEACHER", HttpStatus.BAD_REQUEST);
        }
        if (Boolean.FALSE.equals(targetTeacherUser.getActive())) {
            throw new ApiException("VALIDATION_ERROR", "Assigned teacher is disabled", HttpStatus.BAD_REQUEST);
        }

        Teacher teacher = teacherRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher record not found", HttpStatus.NOT_FOUND));

        Classroom classroom = new Classroom();
        classroom.setName(request.getName().trim());
        classroom.setGradeLevel(request.getGradeLevel());
        classroom.setAcademicYear(request.getAcademicYear() != null ? request.getAcademicYear().trim() : null);
        classroom.setTeacher(teacher);

        Classroom saved = classroomRepository.save(classroom);

        Map<String, Object> meta = new HashMap<>();
        meta.put("classId", saved.getClassId().toString());
        meta.put("name", saved.getName());
        meta.put("teacherId", teacher.getId().toString());
        recordAudit(admin, "ADMIN_CLASS_CREATED", meta);

        return mapToClassResponse(saved, false);
    }

    @Transactional(readOnly = true)
    public Page<AdminClassResponse> getClasses(Pageable pageable) {
        return classroomRepository.findAll(pageable).map(c -> mapToClassResponse(c, false));
    }

    @Transactional(readOnly = true)
    public AdminClassResponse getClass(UUID classId) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));
        return mapToClassResponse(classroom, true);
    }

    @Transactional
    public AdminClassResponse updateClass(UUID classId, UpdateClassRequest request, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        if (request.getName() != null && !request.getName().isBlank()) {
            classroom.setName(request.getName().trim());
        }
        if (request.getGradeLevel() != null) {
            if (request.getGradeLevel() < 1 || request.getGradeLevel() > 5) {
                throw new ApiException("VALIDATION_ERROR", "Grade level must be between 1 and 5", HttpStatus.BAD_REQUEST);
            }
            classroom.setGradeLevel(request.getGradeLevel());
        }
        if (request.getAcademicYear() != null) {
            classroom.setAcademicYear(request.getAcademicYear().trim());
        }

        Classroom updated = classroomRepository.save(classroom);

        Map<String, Object> meta = new HashMap<>();
        meta.put("classId", updated.getClassId().toString());
        recordAudit(admin, "ADMIN_CLASS_UPDATED", meta);

        return mapToClassResponse(updated, true);
    }

    @Transactional
    public AdminClassResponse assignTeacher(UUID classId, UUID teacherId, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        User targetUser = userRepository.findById(teacherId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Target teacher user not found", HttpStatus.NOT_FOUND));

        if (!"TEACHER".equals(targetUser.getRole())) {
            throw new ApiException("VALIDATION_ERROR", "Target user is not a teacher", HttpStatus.BAD_REQUEST);
        }
        if (Boolean.FALSE.equals(targetUser.getActive())) {
            throw new ApiException("VALIDATION_ERROR", "Target teacher is disabled", HttpStatus.BAD_REQUEST);
        }

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher record not found", HttpStatus.NOT_FOUND));

        classroom.setTeacher(teacher);
        Classroom saved = classroomRepository.save(classroom);

        Map<String, Object> meta = new HashMap<>();
        meta.put("classId", classId.toString());
        meta.put("teacherId", teacherId.toString());
        recordAudit(admin, "ADMIN_CLASS_TEACHER_ASSIGNED", meta);

        return mapToClassResponse(saved, true);
    }

    @Transactional
    public AdminClassResponse addStudentToClass(UUID classId, UUID studentId, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        User targetUser = userRepository.findById(studentId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Student user not found", HttpStatus.NOT_FOUND));

        if (!"STUDENT".equals(targetUser.getRole())) {
            throw new ApiException("VALIDATION_ERROR", "Target user is not a student", HttpStatus.BAD_REQUEST);
        }
        if (Boolean.FALSE.equals(targetUser.getActive())) {
            throw new ApiException("VALIDATION_ERROR", "Target student is disabled", HttpStatus.BAD_REQUEST);
        }

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Student record not found", HttpStatus.NOT_FOUND));

        if (classroom.getStudents() == null) {
            classroom.setStudents(new HashSet<>());
        }

        boolean alreadyMember = classroom.getStudents().stream()
                .anyMatch(s -> s.getId().equals(student.getId()));

        if (!alreadyMember) {
            classroom.getStudents().add(student);
            classroomRepository.save(classroom);

            Map<String, Object> meta = new HashMap<>();
            meta.put("classId", classId.toString());
            meta.put("studentId", studentId.toString());
            recordAudit(admin, "ADMIN_STUDENT_ADDED_TO_CLASS", meta);
        }

        return mapToClassResponse(classroom, true);
    }

    @Transactional
    public AdminClassResponse removeStudentFromClass(UUID classId, UUID studentId, String adminEmail) {
        User admin = getAdminActor(adminEmail);
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Classroom not found", HttpStatus.NOT_FOUND));

        if (classroom.getStudents() != null) {
            boolean removed = classroom.getStudents().removeIf(s -> s.getId().equals(studentId));
            if (removed) {
                classroomRepository.save(classroom);

                Map<String, Object> meta = new HashMap<>();
                meta.put("classId", classId.toString());
                meta.put("studentId", studentId.toString());
                recordAudit(admin, "ADMIN_STUDENT_REMOVED_FROM_CLASS", meta);
            }
        }

        return mapToClassResponse(classroom, true);
    }

    // ==========================================
    // DASHBOARD & AUDIT
    // ==========================================

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard() {
        long totalStudents = userRepository.countByRole("STUDENT");
        long activeStudents = userRepository.countByRoleAndActive("STUDENT", true);
        long disabledStudents = totalStudents - activeStudents;

        long totalTeachers = userRepository.countByRole("TEACHER");
        long activeTeachers = userRepository.countByRoleAndActive("TEACHER", true);
        long disabledTeachers = totalTeachers - activeTeachers;

        long totalClasses = classroomRepository.count();

        return AdminDashboardResponse.builder()
                .totalStudents(totalStudents)
                .activeStudents(activeStudents)
                .disabledStudents(disabledStudents)
                .totalTeachers(totalTeachers)
                .activeTeachers(activeTeachers)
                .disabledTeachers(disabledTeachers)
                .totalClasses(totalClasses)
                .build();
    }

    @Transactional(readOnly = true)
    public Page<AdminAuditEventResponse> getAuditEvents(String eventType, Pageable pageable) {
        Page<AuditEvent> events;
        if (eventType != null && !eventType.isBlank()) {
            events = auditEventRepository.findByEventTypeOrderByCreatedAtDesc(eventType.trim(), pageable);
        } else {
            events = auditEventRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return events.map(e -> AdminAuditEventResponse.builder()
                .auditEventId(e.getAuditEventId())
                .eventType(e.getEventType())
                .actorUserId(e.getUser() != null ? e.getUser().getId() : null)
                .actorEmail(e.getUser() != null ? e.getUser().getEmail() : null)
                .metadata(e.getMetadata())
                .createdAt(e.getCreatedAt())
                .build());
    }
}
