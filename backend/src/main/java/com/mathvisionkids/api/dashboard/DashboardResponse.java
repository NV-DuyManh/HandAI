package com.mathvisionkids.api.dashboard;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class DashboardResponse {
    private int todayTotal;
    private int processedCount;
    private int reviewRequiredCount;
    private List<RecentBatchSummary> recentBatches;

    @Data
    public static class RecentBatchSummary {
        private UUID batchId;
        private String assignmentTitle;
        private String status;
        private int totalCount;
        private int processedCount;
        private int reviewRequiredCount;
        private String createdAt;
    }
}
