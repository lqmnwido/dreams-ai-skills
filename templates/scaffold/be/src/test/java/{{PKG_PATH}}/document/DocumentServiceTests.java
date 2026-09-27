package {{BASE_PACKAGE}}.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

/**
 * The domain rules, tested against an in-memory port.
 *
 * No MinIO, no Spring context and no mocks of a client that may change — the
 * fake is fifteen lines implementing {@link DocumentStorage}, and it is the
 * reason the rules below are cheap enough to run on every commit. This is the
 * shape {@code 06-quality/TESTING.md} asks for: the unit layer tests the
 * decision, the adapter gets its own thin test, and neither waits for the other.
 */
class DocumentServiceTests {

    private static final String PREFIX = "{{MODULE_SLUG}}/documents";

    private RecordingStorage storage;

    private DocumentService service;

    @BeforeEach
    void setUp() {
        storage = new RecordingStorage();
        service = new DocumentService(storage);
    }

    @Test
    void uploadStoresUnderTheModulePrefix() {
        DocumentResponse response = service.upload(file("report.pdf", "application/pdf", "content"));

        assertThat(response.key()).startsWith(PREFIX + "/");
        assertThat(response.key()).endsWith("/report.pdf");
        assertThat(storage.lastKey).isEqualTo(response.key());
        assertThat(response.url()).isNotNull();
    }

    @Test
    void uploadRejectsAnEmptyFile() {
        MockMultipartFile empty = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]);

        assertThatThrownBy(() -> service.upload(empty))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("non-empty");
    }

    @Test
    void uploadFlattensAnyPathOutOfTheFilename() {
        MockMultipartFile traversal = file("../../etc/passwd", "text/plain", "x");

        DocumentResponse response = service.upload(traversal);

        assertThat(response.key()).startsWith(PREFIX + "/");
        assertThat(response.key()).doesNotContain("../");
        assertThat(response.key()).doesNotContain("etc");
    }

    @Test
    void resolveRefusesAKeyThisModuleNeverIssued() {
        assertThatThrownBy(() -> service.resolve("another-module/documents/a/b.txt"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("belong to this module");
    }

    @Test
    void resolveRefusesTraversalInsideAnOwnedKey() {
        String key = PREFIX + "/../../secrets.txt";

        assertThatThrownBy(() -> service.resolve(key))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("well formed");
    }

    @Test
    void removeGoesThroughThePort() {
        String key = PREFIX + "/abc/report.pdf";

        service.remove(key);

        assertThat(storage.removedKey).isEqualTo(key);
    }

    private static MockMultipartFile file(String name, String type, String content) {
        return new MockMultipartFile("file", name, type, content.getBytes(StandardCharsets.UTF_8));
    }

    /** The port, in memory. Every test double here is a class, not a stub. */
    private static final class RecordingStorage implements DocumentStorage {

        private String lastKey;

        private String removedKey;

        @Override
        public Stored store(String objectKey, InputStream content, long size, String contentType) {
            this.lastKey = objectKey;
            return new Stored(objectKey, size, contentType);
        }

        @Override
        public Download presign(String objectKey) {
            return new Download(URI.create("http://localhost:9000/b/" + objectKey), 3600);
        }

        @Override
        public void remove(String objectKey) {
            this.removedKey = objectKey;
        }
    }
}
