package com.mathvisionkids.api.batch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.storage.ObjectStorageService;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
public class BatchControllerTest {

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

    @MockBean
    private ObjectStorageService objectStorageService;

    private Teacher teacher1;
    private Teacher teacher2;
    private Student studentInClass;
    private Student studentOutsideClass;
    private Assignment assignment;
    private Batch testBatch;

    @BeforeEach
    public void setup() throws Exception {
        teacher1 = new Teacher();
        teacher1.setEmail("teacher1@test.com");
        teacher1.setPasswordHash("pass");
        teacher1.setRole("TEACHER");
        teacher1.setDisplayName("Teacher 1");
        teacher1 = teacherRepository.save(teacher1);

        teacher2 = new Teacher();
        teacher2.setEmail("teacher2@test.com");
        teacher2.setPasswordHash("pass");
        teacher2.setRole("TEACHER");
        teacher2.setDisplayName("Teacher 2");
        teacher2 = teacherRepository.save(teacher2);

        studentInClass = new Student();
        studentInClass.setEmail("student1@test.com");
        studentInClass.setPasswordHash("pass");
        studentInClass.setRole("STUDENT");
        studentInClass.setGradeLevel(3);
        studentInClass.setDisplayName("Student 1");
        studentInClass = studentRepository.save(studentInClass);

        studentOutsideClass = new Student();
        studentOutsideClass.setEmail("student2@test.com");
        studentOutsideClass.setPasswordHash("pass");
        studentOutsideClass.setRole("STUDENT");
        studentOutsideClass.setGradeLevel(3);
        studentOutsideClass.setDisplayName("Student 2");
        studentOutsideClass = studentRepository.save(studentOutsideClass);

        Classroom classroom = new Classroom();
        classroom.setName("Math 101");
        classroom.setGradeLevel(3);
        classroom.setTeacher(teacher1);
        classroom.getStudents().add(studentInClass);
        classroom = classroomRepository.save(classroom);

        assignment = new Assignment();
        assignment.setTitle("Test Assignment");
        assignment.setOperationType("ADDITION");
        assignment.setTeacher(teacher1);
        assignment.setClassroom(classroom);
        assignment.setMaxScore(100);
        assignment = assignmentRepository.save(assignment);

        testBatch = new Batch();
        testBatch.setTeacher(teacher1);
        testBatch.setAssignment(assignment);
        testBatch.setStatus("CREATED");
        testBatch = batchRepository.save(testBatch);

        when(objectStorageService.store(any(), anyString())).thenReturn("test/path.jpg");
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload10ValidFiles() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 10; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentInClass.getId());
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isAccepted());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload30ValidFiles() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 30; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentInClass.getId());
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isAccepted());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload0FilesRejected() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload1ValidFile() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        MockMultipartFile file = new MockMultipartFile("images", "file0.jpg", "image/jpeg", "content".getBytes());
        builder.file(file);
        
        BatchImageMapping mapping = new BatchImageMapping();
        mapping.setFileIndex(0);
        mapping.setStudentId(studentInClass.getId());
        mappings.add(mapping);

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isAccepted());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload9ValidFiles() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 9; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentInClass.getId());
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isAccepted());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testUpload31FilesRejected() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 31; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentInClass.getId());
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testMissingStudentMapping() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 10; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            // Missing student ID
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher1@test.com", roles = "TEACHER")
    public void testStudentOutsideClassroom() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 10; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentOutsideClass.getId()); // Not in class
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        mockMvc.perform(builder)
               .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher2@test.com", roles = "TEACHER")
    public void testUnauthorizedTeacher() throws Exception {
        List<BatchImageMapping> mappings = new ArrayList<>();
        var builder = multipart("/api/v1/teacher/batches/" + testBatch.getBatchId() + "/submissions");
        
        for (int i = 0; i < 10; i++) {
            MockMultipartFile file = new MockMultipartFile("images", "file" + i + ".jpg", "image/jpeg", "content".getBytes());
            builder.file(file);
            
            BatchImageMapping mapping = new BatchImageMapping();
            mapping.setFileIndex(i);
            mapping.setStudentId(studentInClass.getId());
            mappings.add(mapping);
        }

        builder.param("manifest", objectMapper.writeValueAsString(mappings));

        // teacher2 does not own testBatch
        mockMvc.perform(builder)
               .andExpect(status().isForbidden());
    }
}
