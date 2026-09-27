package {{BASE_PACKAGE}}.web;

import {{BASE_PACKAGE}}.document.StorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * Turns every failure into one response shape, in one place.
 *
 * Without this, each controller wraps its calls in its own {@code try/catch},
 * the four error paths drift into four different body formats, and the one
 * exception nobody caught returns the framework's stack trace to the browser.
 * Controllers therefore declare no {@code try/catch} at all: they throw, and
 * this class decides what the caller is told.
 *
 * Two rules the handlers follow:
 *
 * <ul>
 *   <li>A message returned to a caller is written for that caller. Internal
 *       exception text — which may contain a host name, a bucket name or a file
 *       path — is logged, never returned.</li>
 *   <li>The last handler logs the full stack and returns a generic body. It
 *       never swallows: an exception that reaches here and produces no log line
 *       is the bug this class exists to prevent.</li>
 * </ul>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** The multipart part named {@code file} was not present at all. */
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> missingPart(MissingServletRequestPartException ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.failure("multipart part \"" + ex.getRequestPartName() + "\" is required"));
    }

    /** A rule the domain rejected: empty file, unowned key, illegal name. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> rejected(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.failure(ex.getMessage()));
    }

    /** The body exceeded {@code MAX_FILE_SIZE}. 413, not 500 — it is the caller's size. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> tooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiResponse.failure("uploaded file exceeds the configured size limit"));
    }

    /** Object storage refused or could not be reached. The caller can retry. */
    @ExceptionHandler(StorageException.class)
    public ResponseEntity<ApiResponse<Void>> storage(StorageException ex) {
        log.error("object storage failed: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ApiResponse.failure("object storage is unavailable"));
    }

    /** Nothing else matched. Full stack to the log, generic body to the caller. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> unexpected(Exception ex) {
        log.error("unhandled exception", ex);
        return ResponseEntity.internalServerError().body(ApiResponse.failure("unexpected server error"));
    }
}
