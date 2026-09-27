package com.mathvisionkids.api.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class LocalFileObjectStorageService implements ObjectStorageService {

    private final Path rootLocation;

    public LocalFileObjectStorageService(@Value("${app.storage.upload-root}") String uploadRoot) {
        this.rootLocation = Paths.get(uploadRoot);
        try {
            Files.createDirectories(this.rootLocation);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage location", e);
        }
    }

    @Override
    public String store(MultipartFile file, String directory) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Failed to store empty file.");
        }
        
        String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
        Path dirPath = this.rootLocation.resolve(directory);
        Files.createDirectories(dirPath);
        
        Path targetPath = dirPath.resolve(filename).normalize().toAbsolutePath();
        if (!targetPath.getParent().equals(dirPath.toAbsolutePath())) {
            throw new SecurityException("Cannot store file outside current directory.");
        }
        
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        return directory + "/" + filename;
    }

    @Override
    public void delete(String filePath) throws IOException {
        Path targetPath = this.rootLocation.resolve(filePath).normalize().toAbsolutePath();
        Files.deleteIfExists(targetPath);
    }

    @Override
    public String getAuthorizedReference(String filePath) {
        // Return a virtual/canonical URL instead of raw filesystem path.
        // In real app, this would generate a signed URL or temporary access token.
        return "/api/v1/internal/images?path=" + filePath;
    }

    @Override
    public byte[] loadBytes(String filePath) throws IOException {
        Path targetPath = this.rootLocation.resolve(filePath).normalize().toAbsolutePath();
        if (!Files.exists(targetPath)) {
            throw new IOException("File not found in local storage: " + filePath);
        }
        return Files.readAllBytes(targetPath);
    }
}
