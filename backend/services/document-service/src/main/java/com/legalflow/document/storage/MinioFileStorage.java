package com.legalflow.document.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import java.io.InputStream;

/**
 * Stockage MinIO (compatible S3). Le bucket est créé au premier accès s'il n'existe pas :
 * le démarrage du service ne dépend donc pas de la disponibilité de MinIO.
 */
@Component
@EnableConfigurationProperties(MinioProperties.class)
public class MinioFileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(MinioFileStorage.class);

    private final MinioClient client;
    private final String bucket;
    private volatile boolean bucketReady;

    public MinioFileStorage(MinioProperties properties) {
        this.client = MinioClient.builder()
                .endpoint(properties.getEndpoint())
                .credentials(properties.getAccessKey(), properties.getSecretKey())
                .build();
        this.bucket = properties.getBucket();
    }

    private void ensureBucket() throws Exception {
        if (bucketReady) {
            return;
        }
        synchronized (this) {
            if (!bucketReady) {
                if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket {}", bucket);
                }
                bucketReady = true;
            }
        }
    }

    @Override
    public void put(String key, InputStream content, long size, String contentType) {
        try {
            ensureBucket();
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .stream(content, size, -1)
                    .contentType(contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType)
                    .build());
        } catch (Exception exception) {
            throw new StorageException("Could not store object " + key, exception);
        }
    }

    @Override
    public InputStream get(String key) {
        try {
            ensureBucket();
            return client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception exception) {
            throw new StorageException("Could not read object " + key, exception);
        }
    }

    @Override
    public void delete(String key) {
        try {
            ensureBucket();
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception exception) {
            throw new StorageException("Could not delete object " + key, exception);
        }
    }
}
