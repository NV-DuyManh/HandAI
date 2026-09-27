package com.mathvisionkids.api.config;

import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.classroom.Classroom;
import com.mathvisionkids.api.classroom.ClassroomRepository;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Configuration
@Profile("dev")
public class SeedDataInitializer {

    @Bean
    public CommandLineRunner initData(UserRepository userRepository, 
                                      TeacherRepository teacherRepository,
                                      StudentRepository studentRepository, 
                                      ClassroomRepository classroomRepository,
                                      AssignmentRepository assignmentRepository,
                                      PasswordEncoder passwordEncoder,
                                      PlatformTransactionManager transactionManager) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        return args -> txTemplate.execute(txStatus -> {
            String devPassword = passwordEncoder.encode("MathVision123!");

            // 1. Seed Teacher
            Teacher teacher = teacherRepository.findByEmail("lan.teacher@mathvision.local").orElseGet(() -> {
                Teacher t = new Teacher();
                t.setEmail("lan.teacher@mathvision.local");
                t.setPasswordHash(devPassword);
                t.setRole("TEACHER");
                t.setDisplayName("Ms. Lan");
                return teacherRepository.save(t);
            });

            // 2. Seed 10 Synthetic Demo Students
            String[][] syntheticStudentsData = {
                {"minh.student@mathvision.local", "Nguyễn Bình Minh"},
                {"an.student@mathvision.local", "Trần Văn An"},
                {"binh.student@mathvision.local", "Lê Thanh Bình"},
                {"cuong.student@mathvision.local", "Phạm Quốc Cường"},
                {"dung.student@mathvision.local", "Hoàng Ngọc Dũng"},
                {"giang.student@mathvision.local", "Vũ Hương Giang"},
                {"ha.student@mathvision.local", "Đỗ Thu Hà"},
                {"khoa.student@mathvision.local", "Bùi Anh Khoa"},
                {"linh.student@mathvision.local", "Ngô Phương Linh"},
                {"mai.student@mathvision.local", "Đặng Tuyết Mai"},
                {"nam.student@mathvision.local", "Dương Nhật Nam"}
            };

            List<Student> seededStudents = new ArrayList<>();
            for (String[] studentData : syntheticStudentsData) {
                String email = studentData[0];
                String name = studentData[1];
                Student s = studentRepository.findByEmail(email).orElseGet(() -> {
                    Student newS = new Student();
                    newS.setEmail(email);
                    newS.setPasswordHash(devPassword);
                    newS.setRole("STUDENT");
                    newS.setDisplayName(name);
                    newS.setGradeLevel(3);
                    return studentRepository.save(newS);
                });
                seededStudents.add(s);
            }

            // 3. Seed Demo Classroom (Lớp 3A)
            List<Classroom> existingClasses = classroomRepository.findByTeacher_Id(teacher.getId());
            Classroom classroom;
            if (existingClasses.isEmpty()) {
                classroom = new Classroom();
                classroom.setName("Lớp 3A");
                classroom.setGradeLevel(3);
                classroom.setAcademicYear("2025-2026");
                classroom.setTeacher(teacher);
                classroom.setStudents(new HashSet<>(seededStudents));
                classroom = classroomRepository.save(classroom);
            } else {
                classroom = existingClasses.get(0);
                Set<Student> currentStudents = classroom.getStudents() != null ? new HashSet<>(classroom.getStudents()) : new HashSet<>();
                if (currentStudents.size() < 10) {
                    currentStudents.addAll(seededStudents);
                    classroom.setStudents(currentStudents);
                    classroom = classroomRepository.save(classroom);
                }
            }

            // 4. Seed Demo Assignments
            List<Assignment> existingAssignments = assignmentRepository.findByClassroom_ClassId(classroom.getClassId());
            if (existingAssignments.isEmpty()) {
                Assignment addAssignment = new Assignment();
                addAssignment.setTitle("Bài tập Phép Cộng Dọc");
                addAssignment.setOperationType("VERTICAL_ADDITION");
                addAssignment.setMaxScore(10);
                addAssignment.setStatus("ACTIVE");
                addAssignment.setClassroom(classroom);
                addAssignment.setTeacher(teacher);
                assignmentRepository.save(addAssignment);

                Assignment subAssignment = new Assignment();
                subAssignment.setTitle("Bài tập Phép Trừ Dọc");
                subAssignment.setOperationType("VERTICAL_SUBTRACTION");
                subAssignment.setMaxScore(10);
                subAssignment.setStatus("ACTIVE");
                subAssignment.setClassroom(classroom);
                subAssignment.setTeacher(teacher);
                assignmentRepository.save(subAssignment);
            }

            // 5. Seed Dev Admin
            userRepository.findByEmail("admin.demo@mathvision.local").orElseGet(() -> {
                User admin = new User();
                admin.setEmail("admin.demo@mathvision.local");
                admin.setPasswordHash(devPassword);
                admin.setRole("ADMIN");
                admin.setDisplayName("Demo Administrator");
                admin.setActive(true);
                return userRepository.save(admin);
            });

            System.out.println("Dev seed data initialized successfully: 1 Admin, 1 Teacher, " + seededStudents.size() + " Students, 1 Classroom, 2 Assignments.");
            return null;
        });
    }
}
