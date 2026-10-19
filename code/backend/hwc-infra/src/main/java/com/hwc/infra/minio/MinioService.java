package com.hwc.infra.minio;

import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MinioService {

    private static final long PART_SIZE = 10L * 1024 * 1024;

    private final MinioClient minioClient;

    @SneakyThrows
    public void ensureBucket(String bucket) {
        if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    public String upload(String bucket, String directory, MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String suffix = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
        String objectName = directory + "/" + UUID.randomUUID().toString().replace("-", "") + suffix;
        try (InputStream in = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(in, file.getSize(), PART_SIZE)
                    .contentType(file.getContentType())
                    .build());
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.INTERNAL_ERROR, "文件上传失败：" + e.getMessage());
        }
        return bucket + "/" + objectName;
    }

    public String uploadBytes(String bucket, String directory, String filename, byte[] content) {
        String objectName = directory + "/" + UUID.randomUUID().toString().replace("-", "") + "-"
                + (filename == null || filename.isBlank() ? "file" : filename);
        try (InputStream in = new java.io.ByteArrayInputStream(content)) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(in, content.length, PART_SIZE)
                    .contentType("application/octet-stream")
                    .build());
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.INTERNAL_ERROR, "文件上传失败：" + e.getMessage());
        }
        return bucket + "/" + objectName;
    }

    @SneakyThrows
    public InputStream download(String bucket, String objectName) {
        return minioClient.getObject(GetObjectArgs.builder().bucket(bucket).object(objectName).build());
    }

    @SneakyThrows
    public void remove(String bucket, String objectName) {
        minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectName).build());
    }
}