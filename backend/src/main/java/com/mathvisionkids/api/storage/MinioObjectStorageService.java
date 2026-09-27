package com.mathvisionkids.api.storage;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.GetObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.util.UUID;

@Service
@Primary
public class MinioObjectStorageService implements ObjectStorageService {

    private final MinioClient minioClient;
    private final String bucketName;

    public MinioObjectStorageService(
            @Value("${minio.endpoint}") String endpoint,
            @Value("${minio.access-key}") String accessKey,
            @Value("${minio.secret-key}") String secretKey,
            @Value("${minio.bucket-name}") String bucketName) {
        
        this.minioClient = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        this.bucketName = bucketName;
    }

    @Override
    public String store(MultipartFile file, String directory) throws java.io.IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Failed to store empty file.");
        }
        
        String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
        String objectName = directory + "/" + filename;

        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );
        } catch (Exception e) {
            throw new java.io.IOException("Failed to store file in MinIO", e);
        }
        
        return objectName;
    }

    @Override
    public void delete(String filePath) throws java.io.IOException {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filePath)
                            .build()
            );
        } catch (Exception e) {
            throw new java.io.IOException("Failed to delete file from MinIO", e);
        }
    }

    @Override
    public String getAuthorizedReference(String filePath) {
        return "/api/v1/internal/images?path=" + filePath;
    }

    @Override
    public byte[] loadBytes(String filePath) throws java.io.IOException {
        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(bucketName)
                        .object(filePath)
                        .build())) {
            return stream.readAllBytes();
        } catch (Exception e) {
            throw new java.io.IOException("Failed to load object bytes from MinIO: " + filePath, e);
        }
    }
}
