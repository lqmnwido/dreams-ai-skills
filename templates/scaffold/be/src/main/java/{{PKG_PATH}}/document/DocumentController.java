package {{BASE_PACKAGE}}.document;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import {{BASE_PACKAGE}}.web.ApiResponse;

/**
 * The document upload surface.
 *
 * Thin on purpose. It translates HTTP to a service call and a service result to
 * a status code; there is no {@code try/catch}, no logging and no validation
 * here, because {@code GlobalExceptionHandler} owns failures and
 * {@code DocumentService} owns rules. A controller that does more than this is
 * a second service with an HTTP dependency.
 *
 * The base path is a {@code static final} constant referenced by the annotation
 * so the route and the README table generated from it can never disagree.
 */
@RestController
@RequestMapping(DocumentController.BASE_PATH)
public class DocumentController {

    /** Every endpoint of this controller, and the prefix a key must start with. */
    static final String BASE_PATH = "/api/{{MODULE_SLUG}}/documents";

    private final DocumentService documents;

    /**
     * @param documents the domain service
     */
    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    /**
     * Store an upload. 201 rather than 200: a resource was created, and the
     * {@code Location} in the body is where it now lives.
     *
     * @param file the multipart part named {@code file}
     * @return the created document
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(@RequestPart("file") MultipartFile file) {
        DocumentResponse created = documents.upload(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    /**
     * Redirect to a short-lived download location.
     *
     * A redirect rather than a streamed body: the bytes come straight from
     * object storage instead of passing through this service, so the connection
     * count of a download storm never reaches the JVM.
     *
     * @param key a key this module issued
     * @return 303 to the presigned location
     */
    @GetMapping("/{key:.+}")
    public ResponseEntity<Void> resolve(@PathVariable("key") String key) {
        URI target = documents.resolve(key);
        return ResponseEntity.status(HttpStatus.FOUND).location(target).build();
    }

    /**
     * Delete a document.
     *
     * @param key a key this module issued
     * @return 204 whether or not the object was already gone
     */
    @DeleteMapping("/{key:.+}")
    public ResponseEntity<Void> remove(@PathVariable("key") String key) {
        documents.remove(key);
        return ResponseEntity.noContent().build();
    }
}
