package {{BASE_PACKAGE}}.document;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * The rules this module's documents live by.
 *
 * A single collaborator — the {@link DocumentStorage} port — and nothing else.
 * The service owns four decisions and refuses to delegate them: that a file must
 * exist, what its key is, that the key stays inside this module's prefix, and
 * that a caller may only name keys this module produced. Those are domain rules;
 * moving any of them into the adapter would let a different adapter enforce a
 * different set, which is precisely how one module reads another's documents.
 *
 * Validation happens here rather than in the controller because the controller
 * is a protocol detail: the same rules must hold for the test, for a future
 * message-listener entry point, and for anything else that calls this service.
 */
@Service
public class DocumentService {

    /**
     * Every key this module writes starts with this prefix.
     *
     * The bucket is already per module; the prefix is the second lock, and the
     * one that survives a misconfigured {@code MINIO_BUCKET}.
     */
    private static final String OBJECT_PREFIX = "{{MODULE_SLUG}}/documents";

    private final DocumentStorage storage;

    /**
     * Constructor injection, not {@code @Autowired} on a field: the dependency is
     * visible, final, and impossible to construct without — which is also what
     * makes the unit test below a two-line setup.
     *
     * @param storage the object-store port
     */
    public DocumentService(DocumentStorage storage) {
        this.storage = Objects.requireNonNull(storage, "storage");
    }

    /**
     * Store an upload under a fresh module-owned key.
     *
     * @param file the multipart file
     * @return the key, size, type and a short-lived download location
     * @throws IllegalArgumentException if the file is missing, empty or unnamed
     * @throws StorageException if the object could not be stored
     */
    public DocumentResponse upload(MultipartFile file) {
        String filename = requireFilename(file);
        String key = objectKey(filename);

        DocumentStorage.Stored stored;
        try (InputStream content = file.getInputStream()) {
            stored = storage.store(key, content, file.getSize(), contentType(file));
        } catch (IOException ex) {
            throw new StorageException("could not read the uploaded file", ex);
        }

        return new DocumentResponse(
                stored.key(),
                stored.size(),
                stored.contentType(),
                storage.presign(key).url());
    }

    /**
     * A short-lived location the caller may fetch.
     *
     * @param key a key this module produced
     * @return the presigned location
     */
    public URI resolve(String key) {
        return storage.presign(requireOwnedKey(key)).url();
    }

    /**
     * Delete a document. A key that was never issued here is refused before the
     * adapter sees it, so a guessed key cannot reach the storage client at all.
     *
     * @param key a key this module produced
     */
    public void remove(String key) {
        storage.remove(requireOwnedKey(key));
    }

    private String requireFilename(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("a non-empty file is required");
        }
        String original =
                Optional.ofNullable(file.getOriginalFilename()).orElse("").trim();
        if (original.isEmpty()) {
            throw new IllegalArgumentException("the uploaded file has no name");
        }
        return original;
    }

    /**
     * {@code <prefix>/<uuid>/<sanitised filename>}.
     *
     * The UUID is what makes two uploads of the same filename coexist, and what
     * removes any reason to trust the filename as a path component. It is the
     * filename — not the key — that is sanitised, so the traversal attempt dies
     * here instead of reaching the object store.
     */
    private String objectKey(String filename) {
        return OBJECT_PREFIX + "/" + UUID.randomUUID() + "/" + sanitize(filename);
    }

    /**
     * Keep letters, digits, {@code .}, {@code -} and {@code _}; everything else
     * becomes {@code _}. Unicode letters survive, because a Malay or Chinese
     * filename is not an error. Leading and repeated dots are dropped so no key
     * this module issues can ever contain {@code ..}.
     */
    private String sanitize(String filename) {
        String leaf = filename.replace('\\', '/');
        int separator = leaf.lastIndexOf('/');
        if (separator >= 0) {
            leaf = leaf.substring(separator + 1);
        }

        StringBuilder safe = new StringBuilder(leaf.length());
        for (int i = 0; i < leaf.length(); i++) {
            char current = leaf.charAt(i);
            if (current == '.' && (safe.length() == 0 || safe.charAt(safe.length() - 1) == '.')) {
                continue;
            }
            if (current == '.' || current == '-' || current == '_' || Character.isLetterOrDigit(current)) {
                safe.append(current);
            } else {
                safe.append('_');
            }
        }
        return safe.length() == 0 ? "document" : safe.toString();
    }

    private String requireOwnedKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("a document key is required");
        }
        String normalized = key.replace('\\', '/').trim();
        if (!normalized.startsWith(OBJECT_PREFIX + "/")) {
            throw new IllegalArgumentException("that document does not belong to this module");
        }
        if (normalized.contains("..") || normalized.indexOf('\0') >= 0) {
            throw new IllegalArgumentException("the document key is not well formed");
        }
        return normalized;
    }

    private String contentType(MultipartFile file) {
        String type = file.getContentType();
        return type == null || type.isBlank() ? "application/octet-stream" : type;
    }
}
