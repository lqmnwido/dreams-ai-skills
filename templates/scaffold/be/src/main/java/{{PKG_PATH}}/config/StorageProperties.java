package {{BASE_PACKAGE}}.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Object-storage settings for this module, bound from {@code storage.*} in
 * {@code application.yml} — which reads {@code MINIO_*} from this repository's
 * own {@code .env}.
 *
 * A record rather than a mutable JavaBean: these values are set once at startup
 * and never change, and a configuration object with setters is a configuration
 * object that something will mutate at three in the afternoon.
 *
 * The bucket accessor refuses to return an empty value. A write to a blank
 * bucket name fails deep inside the S3 client with a message that names neither
 * the module nor the file, and the mistake is always "someone deployed without
 * the module's environment".
 */
@ConfigurationProperties(prefix = "storage")
public record StorageProperties(String endpoint, String accessKey, String secretKey, String bucket, String region) {

    /**
     * The bucket this module owns. Never blank, never another module's.
     *
     * @return the configured bucket name
     * @throws IllegalStateException if no bucket was configured
     */
    public String requireBucket() {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException(
                    "storage.bucket is not set — set MINIO_BUCKET in this module's .env (one bucket per module)");
        }
        return bucket;
    }
}
