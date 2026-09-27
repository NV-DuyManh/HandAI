package com.mathvisionkids.api.user;

import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "students")
@PrimaryKeyJoinColumn(name = "student_id")
@Getter
@Setter
@NoArgsConstructor
public class Student extends User {
    private Integer gradeLevel;
}
