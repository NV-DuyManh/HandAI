package com.mathvisionkids.api.storage;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

public interface ObjectStorageService {
    String store(MultipartFile file, String directory) throws IOException;
    void delete(String filePath) throws IOException;
    String getAuthorizedReference(String filePath);
    byte[] loadBytes(String filePath) throws IOException;
}
