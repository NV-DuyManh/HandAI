package com.mathvisionkids.api.batch;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BatchRepository extends JpaRepository<Batch, UUID> {
    List<Batch> findByTeacher_IdOrderByCreatedAtDesc(UUID teacherId);
}
