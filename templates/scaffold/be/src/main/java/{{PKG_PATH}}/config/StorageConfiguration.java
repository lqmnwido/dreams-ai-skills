package {{BASE_PACKAGE}}.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.minio.MinioClient;

/**
 * Wires object storage for this module.
 *
 * The client is built here rather than inside the adapter because building it is
 * configuration, not behaviour: the adapter should receive a ready client and
 * contain nothing but S3 calls. The client does not open a connection when it is
 * constructed, so the service starts — and reports health — even when MinIO is
 * down; only the first upload fails, and it fails through
 * {@code StorageException} with a message that names the bucket.
 */
@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfiguration {

    /**
     * The MinIO client for this module's own bucket.
     *
     * @param properties bound {@code storage.*} settings
     * @return a client configured from this module's environment
     */
    @Bean
    MinioClient minioClient(StorageProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.endpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .build();
    }
}
