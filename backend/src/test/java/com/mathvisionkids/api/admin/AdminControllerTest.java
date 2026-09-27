package com.mathvisionkids.api.admin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.admin.dto.*;
import com.mathvisionkids.api.audit.AuditEvent;
import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.auth.JwtUtil;
import com.mathvisionkids.api.auth.RefreshTokenRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.user.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private AuditEventRepository auditEventRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User adminUser;
    private String adminToken;

    private Teacher teacherUser;
    private String teacherToken;

    private Student studentUser;
    private String studentToken;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdClassIds = new ArrayList<>();

    @BeforeEach
    public void setup() {
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.execute(status -> {
            // 1. Admin
            adminUser = new User();
            adminUser.setEmail("admin.test." + UUID.randomUUID() + "@mathvision.local");
            adminUser.setPasswordHash(passwordEncoder.encode("AdminPass123!"));
            adminUser.setRole("ADMIN");
            adminUser.setDisplayName("Test Admin");
            adminUser.setActive(true);
            adminUser = userRepository.save(adminUser);
            createdUserIds.add(adminUser.getId());

            // 2. Teacher
            teacherUser = new Teacher();
            teacherUser.setEmail("teacher.test." + UUID.randomUUID() + "@mathvision.local");
            teacherUser.setPasswordHash(passwordEncoder.encode("TeacherPass123!"));
            teacherUser.setRole("TEACHER");
            teacherUser.setDisplayName("Test Teacher");
            teacherUser.setActive(true);
            teacherUser = teacherRepository.save(teacherUser);
            createdUserIds.add(teacherUser.getId());

            // 3. Student
            studentUser = new Student();
            studentUser.setEmail("student.test." + UUID.randomUUID() + "@mathvision.local");
            studentUser.setPasswordHash(passwordEncoder.encode("StudentPass123!"));
            studentUser.setRole("STUDENT");
            studentUser.setDisplayName("Test Student");
            studentUser.setActive(true);
            studentUser.setGradeLevel(3);
            studentUser = studentRepository.save(studentUser);
            createdUserIds.add(studentUser.getId());

            return null;
        });

        adminToken = jwtUtil.generateToken(adminUser.getEmail(), "ADMIN");
        teacherToken = jwtUtil.generateToken(teacherUser.getEmail(), "TEACHER");
        studentToken = jwtUtil.generateToken(studentUser.getEmail(), "STUDENT");
    }

    @AfterEach
    public void cleanup() {
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.execute(status -> {
            for (UUID classId : createdClassIds) {
                if (classroomRepository.existsById(classId)) {
                    classroomRepository.deleteById(classId);
                }
            }
            // Delete audit events referencing any of the created users
            for (UUID userId : createdUserIds) {
                userRepository.findById(userId).ifPresent(u -> {
                    List<AuditEvent> events = auditEventRepository.findAll().stream()
                            .filter(e -> e.getUser() != null && e.getUser().getId().equals(u.getId()))
                            .toList();
                    auditEventRepository.deleteAll(events);
                    refreshTokenRepository.deleteByUser(u);
                    
                    // Also delete any classroom where this user was assigned as teacher
                    List<Classroom> taught = classroomRepository.findByTeacher_Id(u.getId());
                    classroomRepository.deleteAll(taught);
                });
            }
            for (UUID userId : createdUserIds) {
                userRepository.findById(userId).ifPresent(userRepository::delete);
            }
            return null;
        });
    }

    // ============================================================
    // 1. AUTH & RBAC TESTS
    // ============================================================

    @Test
    public void testAdminLoginAndMe() throws Exception {
        Map<String, String> loginReq = new HashMap<>();
        loginReq.put("email", adminUser.getEmail());
        loginReq.put("password", "AdminPass123!");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andReturn();

        String respStr = loginResult.getResponse().getContentAsString();
        Map<String, String> data = objectMapper.readValue(respStr, new TypeReference<>() {});
        String token = data.get("accessToken");

        mockMvc.perform(get("/api/v1/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value(adminUser.getEmail()))
                .andExpect(jsonPath("$.displayName").value("Test Admin"));
    }

    @Test
    public void testUnauthenticatedAdminAccessReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testStudentCannotAccessAdminRoutesReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard")
                .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testTeacherCannotAccessAdminRoutesReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard")
                .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testAdminAllowedToAccessAdminRoutes() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalStudents").exists());
    }

    @Test
    public void testAdminCannotGradeReturns403() throws Exception {
        UUID fakeSubmissionId = UUID.randomUUID();

        // 1. Approve attempt -> 403
        mockMvc.perform(post("/api/v1/teacher/submissions/" + fakeSubmissionId + "/approve")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        // 2. Override attempt -> 403
        Map<String, Object> overrideReq = new HashMap<>();
        overrideReq.put("finalScore", 10);
        overrideReq.put("reason", "Admin override");
        mockMvc.perform(post("/api/v1/teacher/submissions/" + fakeSubmissionId + "/override")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overrideReq)))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 2. USER PROVISIONING & LIFECYCLE TESTS
    // ============================================================

    @Test
    public void testAdminCreatesStudentAndTeacherSuccessfully() throws Exception {
        // Create Student
        CreateUserRequest studentReq = new CreateUserRequest();
        studentReq.setEmail("new.student." + UUID.randomUUID() + "@mathvision.local");
        studentReq.setDisplayName("New Student");
        studentReq.setRole("STUDENT");
        studentReq.setInitialPassword("SecurePass123!");
        studentReq.setGradeLevel(3);

        MvcResult sResult = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(studentReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").exists())
                .andExpect(jsonPath("$.role").value("STUDENT"))
                .andExpect(jsonPath("$.gradeLevel").value(3))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        AdminUserResponse sResp = objectMapper.readValue(sResult.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(sResp.getUserId());

        // Create Teacher
        CreateUserRequest teacherReq = new CreateUserRequest();
        teacherReq.setEmail("new.teacher." + UUID.randomUUID() + "@mathvision.local");
        teacherReq.setDisplayName("New Teacher");
        teacherReq.setRole("TEACHER");
        teacherReq.setInitialPassword("SecurePass123!");

        MvcResult tResult = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(teacherReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").exists())
                .andExpect(jsonPath("$.role").value("TEACHER"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        AdminUserResponse tResp = objectMapper.readValue(tResult.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(tResp.getUserId());
    }

    @Test
    public void testAdminCreatingAdminRoleRejected() throws Exception {
        CreateUserRequest adminReq = new CreateUserRequest();
        adminReq.setEmail("another.admin." + UUID.randomUUID() + "@mathvision.local");
        adminReq.setDisplayName("Another Admin");
        adminReq.setRole("ADMIN");
        adminReq.setInitialPassword("SecurePass123!");

        mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adminReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testDuplicateEmailRejected() throws Exception {
        CreateUserRequest duplicateReq = new CreateUserRequest();
        duplicateReq.setEmail(studentUser.getEmail());
        duplicateReq.setDisplayName("Duplicate Student");
        duplicateReq.setRole("STUDENT");
        duplicateReq.setInitialPassword("SecurePass123!");
        duplicateReq.setGradeLevel(2);

        mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(duplicateReq)))
                .andExpect(status().isConflict());
    }

    @Test
    public void testStudentGradeValidation() throws Exception {
        // Grade < 1
        CreateUserRequest reqLow = new CreateUserRequest();
        reqLow.setEmail("low.grade." + UUID.randomUUID() + "@mathvision.local");
        reqLow.setDisplayName("Low Grade");
        reqLow.setRole("STUDENT");
        reqLow.setInitialPassword("SecurePass123!");
        reqLow.setGradeLevel(0);

        mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqLow)))
                .andExpect(status().isBadRequest());

        // Grade > 5
        CreateUserRequest reqHigh = new CreateUserRequest();
        reqHigh.setEmail("high.grade." + UUID.randomUUID() + "@mathvision.local");
        reqHigh.setDisplayName("High Grade");
        reqHigh.setRole("STUDENT");
        reqHigh.setInitialPassword("SecurePass123!");
        reqHigh.setGradeLevel(6);

        mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqHigh)))
                .andExpect(status().isBadRequest());

        // Grade 1 accepted
        CreateUserRequest req1 = new CreateUserRequest();
        req1.setEmail("grade1." + UUID.randomUUID() + "@mathvision.local");
        req1.setDisplayName("Grade 1 Student");
        req1.setRole("STUDENT");
        req1.setInitialPassword("SecurePass123!");
        req1.setGradeLevel(1);

        MvcResult r1 = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminUserResponse resp1 = objectMapper.readValue(r1.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(resp1.getUserId());

        // Grade 5 accepted
        CreateUserRequest req5 = new CreateUserRequest();
        req5.setEmail("grade5." + UUID.randomUUID() + "@mathvision.local");
        req5.setDisplayName("Grade 5 Student");
        req5.setRole("STUDENT");
        req5.setInitialPassword("SecurePass123!");
        req5.setGradeLevel(5);

        MvcResult r5 = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req5)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminUserResponse resp5 = objectMapper.readValue(r5.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(resp5.getUserId());
    }

    @Test
    public void testTeacherWithGradeLevelRejected() throws Exception {
        CreateUserRequest req = new CreateUserRequest();
        req.setEmail("teacher.invalid." + UUID.randomUUID() + "@mathvision.local");
        req.setDisplayName("Invalid Teacher");
        req.setRole("TEACHER");
        req.setInitialPassword("SecurePass123!");
        req.setGradeLevel(3);

        mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testAdminUpdateUser() throws Exception {
        UpdateUserRequest updateReq = new UpdateUserRequest();
        updateReq.setDisplayName("Updated Student Name");
        updateReq.setGradeLevel(4);

        mockMvc.perform(patch("/api/v1/admin/users/" + studentUser.getId())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Updated Student Name"))
                .andExpect(jsonPath("$.gradeLevel").value(4));
    }

    @Test
    public void testAdminDisableAndEnableUser() throws Exception {
        // 1. Create a fresh student for this test
        CreateUserRequest sReq = new CreateUserRequest();
        String email = "disable.test." + UUID.randomUUID() + "@mathvision.local";
        sReq.setEmail(email);
        sReq.setDisplayName("Disable Test Student");
        sReq.setRole("STUDENT");
        sReq.setInitialPassword("TestPass123!");
        sReq.setGradeLevel(2);

        MvcResult sRes = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sReq)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminUserResponse createdStudent = objectMapper.readValue(sRes.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(createdStudent.getUserId());

        // 2. Verify student can login
        Map<String, String> loginReq = new HashMap<>();
        loginReq.put("email", email);
        loginReq.put("password", "TestPass123!");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, String> authData = objectMapper.readValue(loginResult.getResponse().getContentAsString(), new TypeReference<>() {});
        String refreshToken = authData.get("refreshToken");

        // 3. Admin disables student
        mockMvc.perform(post("/api/v1/admin/users/" + createdStudent.getUserId() + "/disable")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // 4. Student login is rejected
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isUnauthorized());

        // 5. Existing refresh token is rejected
        Map<String, String> refreshReq = new HashMap<>();
        refreshReq.put("refreshToken", refreshToken);
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isUnauthorized());

        // 6. Admin enables student
        mockMvc.perform(post("/api/v1/admin/users/" + createdStudent.getUserId() + "/enable")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // 7. Student can login again
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    public void testAdminCannotDisableSelf() throws Exception {
        mockMvc.perform(post("/api/v1/admin/users/" + adminUser.getId() + "/disable")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testAdminPasswordReset() throws Exception {
        ResetPasswordRequest req = new ResetPasswordRequest();
        req.setTemporaryPassword("NewTempPass123!");

        mockMvc.perform(post("/api/v1/admin/users/" + studentUser.getId() + "/reset-password")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temporaryPassword").value("NewTempPass123!"));

        // Verify login with new temporary password
        Map<String, String> loginReq = new HashMap<>();
        loginReq.put("email", studentUser.getEmail());
        loginReq.put("password", "NewTempPass123!");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk());
    }

    // ============================================================
    // 3. CLASSROOM & ROSTER MANAGEMENT TESTS
    // ============================================================

    @Test
    public void testAdminClassroomLifecycle() throws Exception {
        // Create Class
        CreateClassRequest classReq = new CreateClassRequest();
        classReq.setName("Lớp 4B Thử Nghiệm");
        classReq.setGradeLevel(4);
        classReq.setAcademicYear("2025-2026");
        classReq.setTeacherId(teacherUser.getId());

        MvcResult cRes = mockMvc.perform(post("/api/v1/admin/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(classReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.classId").exists())
                .andExpect(jsonPath("$.name").value("Lớp 4B Thử Nghiệm"))
                .andExpect(jsonPath("$.gradeLevel").value(4))
                .andReturn();

        AdminClassResponse classResp = objectMapper.readValue(cRes.getResponse().getContentAsString(), AdminClassResponse.class);
        createdClassIds.add(classResp.getClassId());

        // Read Class
        mockMvc.perform(get("/api/v1/admin/classes/" + classResp.getClassId())
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Lớp 4B Thử Nghiệm"))
                .andExpect(jsonPath("$.teacher.userId").value(teacherUser.getId().toString()));

        // Update Class
        UpdateClassRequest updateReq = new UpdateClassRequest();
        updateReq.setName("Lớp 4B Chuyên Toán");
        mockMvc.perform(patch("/api/v1/admin/classes/" + classResp.getClassId())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Lớp 4B Chuyên Toán"));
    }

    @Test
    public void testCreateClassGradeValidation() throws Exception {
        CreateClassRequest lowReq = new CreateClassRequest();
        lowReq.setName("Invalid Low Class");
        lowReq.setGradeLevel(0);
        lowReq.setTeacherId(teacherUser.getId());

        mockMvc.perform(post("/api/v1/admin/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(lowReq)))
                .andExpect(status().isBadRequest());

        CreateClassRequest highReq = new CreateClassRequest();
        highReq.setName("Invalid High Class");
        highReq.setGradeLevel(6);
        highReq.setTeacherId(teacherUser.getId());

        mockMvc.perform(post("/api/v1/admin/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(highReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testTeacherAssignmentValidation() throws Exception {
        // Create class with valid teacher
        CreateClassRequest classReq = new CreateClassRequest();
        classReq.setName("Test Assignment Class");
        classReq.setGradeLevel(2);
        classReq.setTeacherId(teacherUser.getId());

        MvcResult cRes = mockMvc.perform(post("/api/v1/admin/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(classReq)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminClassResponse classResp = objectMapper.readValue(cRes.getResponse().getContentAsString(), AdminClassResponse.class);
        createdClassIds.add(classResp.getClassId());

        // Assign student as teacher -> 400
        AssignTeacherRequest studentAsTeacher = new AssignTeacherRequest();
        studentAsTeacher.setTeacherId(studentUser.getId());
        mockMvc.perform(put("/api/v1/admin/classes/" + classResp.getClassId() + "/teacher")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(studentAsTeacher)))
                .andExpect(status().isBadRequest());

        // Disable teacher, then attempt assignment -> 400
        mockMvc.perform(post("/api/v1/admin/users/" + teacherUser.getId() + "/disable")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        AssignTeacherRequest disabledTeacherReq = new AssignTeacherRequest();
        disabledTeacherReq.setTeacherId(teacherUser.getId());
        mockMvc.perform(put("/api/v1/admin/classes/" + classResp.getClassId() + "/teacher")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(disabledTeacherReq)))
                .andExpect(status().isBadRequest());

        // Re-enable teacher
        mockMvc.perform(post("/api/v1/admin/users/" + teacherUser.getId() + "/enable")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    public void testStudentClassMembershipAndRosterInvariant() throws Exception {
        // Create class
        CreateClassRequest classReq = new CreateClassRequest();
        classReq.setName("Roster Invariant Class");
        classReq.setGradeLevel(3);
        classReq.setTeacherId(teacherUser.getId());

        MvcResult cRes = mockMvc.perform(post("/api/v1/admin/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(classReq)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminClassResponse classResp = objectMapper.readValue(cRes.getResponse().getContentAsString(), AdminClassResponse.class);
        createdClassIds.add(classResp.getClassId());

        // 1. Attempt adding Teacher as Student -> 400
        mockMvc.perform(post("/api/v1/admin/classes/" + classResp.getClassId() + "/students/" + teacherUser.getId())
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        // 2. Add active Student to Class -> 200
        mockMvc.perform(post("/api/v1/admin/classes/" + classResp.getClassId() + "/students/" + studentUser.getId())
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentCount").value(1));

        // 3. Duplicate addition handled safely (idempotent)
        mockMvc.perform(post("/api/v1/admin/classes/" + classResp.getClassId() + "/students/" + studentUser.getId())
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentCount").value(1));

        // 4. Verify ROSTER INVARIANT: Student is directly present in canonical Classroom.students entity
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.execute(status -> {
            Classroom c = classroomRepository.findById(classResp.getClassId()).orElseThrow();
            assertNotNull(c.getStudents());
            boolean present = c.getStudents().stream().anyMatch(s -> s.getId().equals(studentUser.getId()));
            assertTrue(present, "Student must be present in canonical Classroom.students roster for batch upload");
            return null;
        });

        // 5. Remove Student from Class -> 200
        mockMvc.perform(delete("/api/v1/admin/classes/" + classResp.getClassId() + "/students/" + studentUser.getId())
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentCount").value(0));
    }

    // ============================================================
    // 4. AUDIT EVENT LOGGING VERIFICATION
    // ============================================================

    @Test
    public void testAdminWritesEmitAuditEvents() throws Exception {
        // Create Student to trigger ADMIN_USER_CREATED
        CreateUserRequest sReq = new CreateUserRequest();
        sReq.setEmail("audit.student." + UUID.randomUUID() + "@mathvision.local");
        sReq.setDisplayName("Audit Test Student");
        sReq.setRole("STUDENT");
        sReq.setInitialPassword("AuditPass123!");
        sReq.setGradeLevel(1);

        MvcResult sRes = mockMvc.perform(post("/api/v1/admin/users")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sReq)))
                .andExpect(status().isCreated())
                .andReturn();
        AdminUserResponse created = objectMapper.readValue(sRes.getResponse().getContentAsString(), AdminUserResponse.class);
        createdUserIds.add(created.getUserId());

        // Verify audit event exists
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.execute(status -> {
            List<AuditEvent> events = auditEventRepository.findAll();
            boolean found = events.stream().anyMatch(e -> 
                "ADMIN_USER_CREATED".equals(e.getEventType()) &&
                e.getUser() != null &&
                adminUser.getId().equals(e.getUser().getId()) &&
                e.getMetadata() != null &&
                created.getUserId().toString().equals(e.getMetadata().get("targetUserId"))
            );
            assertTrue(found, "Audit event ADMIN_USER_CREATED must be recorded with actor Admin identity and target");
            return null;
        });

        // Test GET /api/v1/admin/audit endpoint
        mockMvc.perform(get("/api/v1/admin/audit")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].eventType").exists());
    }
}
