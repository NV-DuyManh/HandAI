package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.submission.SubmissionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiGatewayConfig {

    @Bean
    @ConditionalOnProperty(name = "ai.gateway.mode", havingValue = "STUB", matchIfMissing = true)
    public AiAnalysisGateway stubAiAnalysisGateway(
            SubmissionRepository submissionRepository, 
            AnalysisResultRepository analysisResultRepository, 
            AuditEventRepository auditEventRepository, 
            AiJobRepository aiJobRepository) {
        return new StubAiAnalysisGateway(submissionRepository, analysisResultRepository, auditEventRepository, aiJobRepository);
    }

    @Bean
    @ConditionalOnProperty(name = "ai.gateway.mode", havingValue = "FASTAPI")
    public AiAnalysisGateway httpAiAnalysisGateway(
            SubmissionRepository submissionRepository, 
            AiJobRepository aiJobRepository,
            com.mathvisionkids.api.submission.SubmissionImageRepository submissionImageRepository,
            @Value("${ai.gateway.url:http://localhost:8000/internal/v1/jobs}") String aiServiceUrl,
            org.springframework.beans.factory.ObjectProvider<org.springframework.transaction.PlatformTransactionManager> transactionManagerProvider) {
        org.springframework.transaction.PlatformTransactionManager tm = transactionManagerProvider.getIfAvailable();
        org.springframework.transaction.support.TransactionTemplate tt = tm != null ? new org.springframework.transaction.support.TransactionTemplate(tm) : null;
        return new HttpAiAnalysisGateway(
                submissionRepository,
                aiJobRepository,
                submissionImageRepository,
                aiServiceUrl,
                null,
                tt
        );
    }

    public AiAnalysisGateway httpAiAnalysisGateway(
            SubmissionRepository submissionRepository, 
            AiJobRepository aiJobRepository,
            com.mathvisionkids.api.submission.SubmissionImageRepository submissionImageRepository,
            String aiServiceUrl) {
        return new HttpAiAnalysisGateway(submissionRepository, aiJobRepository, submissionImageRepository, aiServiceUrl);
    }
}
