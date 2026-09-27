package com.mathvisionkids.api.user;

import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "teachers")
@PrimaryKeyJoinColumn(name = "teacher_id")
@Getter
@Setter
@NoArgsConstructor
public class Teacher extends User {
}
