package {{BASE_PACKAGE}}.storage;

import {{BASE_PACKAGE}}.config.StorageProperties;
import {{BASE_PACKAGE}}.document.DocumentStorage;
import {{BASE_PACKAGE}}.document.StorageException;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import java.io.InputStream;
import java.net.URI;
import org.springframework.stereotype.Service;

/**
 * The S3 adapter: the only class in this module that knows MinIO exists.
 *
 * It implements {@link DocumentStorage}, so the domain sees a port and the
 * object-store SDK is confined to this file. Two consequences worth stating:
 *
 * <ul>
 *   <li>Replacing MinIO means adding one class here and annotating it instead of
 *       this one — no controller, service or test changes.</li>
 *   <li>Every exception the client can throw is translated to
 *       {@link StorageException} here, at the boundary. The SDK raises about a
 *       dozen checked types for one failure mode; catching them per call site
 *       produces a dozen messages for one outage.</li>
 * </ul>
 *
 * The bucket is read per call rather than cached, so changing
 * {@code MINIO_BUCKET} and restarting is enough — there is no second copy of the
 * value to get wrong.
 */
@Service
public class MinioStorageService implements DocumentStorage {

    /** One hour. Long enough to open a document, short enough to expire. */
    private static final int PRESIGN_TTL_SECONDS = 3600;

    private final MinioClient client;

    private final StorageProperties properties;

    /**
     * @param client built by {@code StorageConfiguration} from this module's env
     * @param properties bound {@code storage.*} settings
     */
    public MinioStorageService(MinioClient client, StorageProperties properties) {
        this.client = client;
        this.properties = properties;
    }

    @Override
    public Stored store(String objectKey, InputStream content, long size, String contentType) {
        String bucket = properties.requireBucket();
        try {
            client.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey).stream(content, size, -1L)
                    .contentType(contentType)
                    .build());
        } catch (Exception ex) {
            throw new StorageException("put into bucket \"" + bucket + "\" failed for " + objectKey, ex);
        }
        return new Stored(objectKey, size, contentType);
    }

    @Override
    public Download presign(String objectKey) {
        String bucket = properties.requireBucket();
        try {
            String location = client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(bucket)
                    .object(objectKey)
                    .expiry(PRESIGN_TTL_SECONDS)
                    .build());
            return new Download(URI.create(location), PRESIGN_TTL_SECONDS);
        } catch (Exception ex) {
            throw new StorageException("presign in bucket \"" + bucket + "\" failed for " + objectKey, ex);
        }
    }

    @Override
    public void remove(String objectKey) {
        String bucket = properties.requireBucket();
        try {
            client.removeObject(
                    RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception ex) {
            throw new StorageException("remove from bucket \"" + bucket + "\" failed for " + objectKey, ex);
        }
    }
}
