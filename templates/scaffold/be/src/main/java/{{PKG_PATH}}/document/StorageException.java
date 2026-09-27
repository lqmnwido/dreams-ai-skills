package {{BASE_PACKAGE}}.document;

/**
 * Object storage refused the operation, or could not be reached.
 *
 * This is the boundary exception of the storage port. The adapter translates
 * every failure its client can produce — network, credentials, bucket, XML —
 * into this one type, and the domain never sees an S3 class. That translation
 * belongs at the boundary and nowhere else: doing it per call site is how four
 * different error messages for the same outage end up in four logs.
 *
 * Unchecked, because a storage failure is not something a caller can recover
 * from by catching it closer to the source — it either retries or fails the
 * request, which {@code GlobalExceptionHandler} already decides.
 */
public class StorageException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param message what failed, including the bucket when it is known
     */
    public StorageException(String message) {
        super(message);
    }

    /**
     * @param message what failed
     * @param cause the client exception, always kept — losing it makes the log
     *     useless for the one case where the log is the only evidence
     */
    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
