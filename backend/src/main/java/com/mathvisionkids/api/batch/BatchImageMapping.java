package com.mathvisionkids.api.batch;

import lombok.Data;
import java.util.UUID;

@Data
public class BatchImageMapping {
    private Integer fileIndex;
    private UUID studentId;
}
