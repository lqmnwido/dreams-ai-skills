package {{BASE_PACKAGE}}.document;

import java.net.URI;

/**
 * What the caller is told about a document.
 *
 * Deliberately not the stored object: the caller never receives the storage
 * endpoint, the bucket name or a credential, only a key it may act on later and
 * a location that expires.
 *
 * @param key the module-owned key, safe to echo back and to pass to this API
 * @param size bytes stored
 * @param contentType the media type recorded with the object
 * @param url a presigned download location with a limited lifetime
 */
public record DocumentResponse(String key, long size, String contentType, URI url) {
}
