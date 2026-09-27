package {{BASE_PACKAGE}}.document;

import java.io.InputStream;
import java.net.URI;

/**
 * The port this module writes documents through.
 *
 * The domain depends on this interface; the S3 implementation lives in
 * {@code storage} and depends on the domain. That inversion is the whole point:
 * {@code DocumentServiceTests} exercises upload, key sanitisation and ownership
 * rules with an in-memory fake and no MinIO running, and the module could move
 * to a different object store by adding one class here.
 *
 * Keys are always <em>module-owned</em>: {@code <module-slug>/documents/...}.
 * A bucket is per module, and the prefix is the second lock on the same rule —
 * so a bug that produces the wrong key cannot read another module's objects.
 */
public interface DocumentStorage {

    /**
     * A stored object, as the caller needs to know it.
     *
     * @param key the module-owned object key
     * @param size bytes written
     * @param contentType the media type recorded with the object
     */
    record Stored(String key, long size, String contentType) {
    }

    /**
     * A short-lived download location.
     *
     * @param url the presigned location; no credentials are in the response body
     * @param ttlSeconds how long the location stays valid
     */
    record Download(URI url, long ttlSeconds) {
    }

    /**
     * Store an object under {@code objectKey}, replacing anything already there.
     *
     * @param objectKey module-owned key
     * @param content the bytes
     * @param size how many bytes, or {@code -1} when unknown
     * @param contentType the media type to record
     * @return what was stored
     * @throws StorageException if the store did not happen
     */
    Stored store(String objectKey, InputStream content, long size, String contentType);

    /**
     * A URL the caller may fetch directly.
     *
     * @param objectKey module-owned key
     * @return the presigned download
     * @throws StorageException if the location could not be produced
     */
    Download presign(String objectKey);

    /**
     * Delete an object. Deleting an object that does not exist is a no-op, not
     * an error: "delete then verify" must not depend on a prior read.
     *
     * @param objectKey module-owned key
     * @throws StorageException if the delete did not happen
     */
    void remove(String objectKey);
}
