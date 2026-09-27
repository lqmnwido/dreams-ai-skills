package {{BASE_PACKAGE}}.web;

/**
 * The one response envelope this API speaks.
 *
 * Every endpoint returns {@code ApiResponse<T>}, so a client never has to guess
 * whether a 404 means "not found" or "the body was not JSON". The HTTP status
 * carries the outcome; {@code success} and {@code message} exist for the cases
 * where the body is all a browser can reach — a redirect, a streamed error.
 *
 * A record, because it is a value with no behaviour and no reason to be
 * subclassed.
 *
 * @param <T> the payload type, or {@code Void} for endpoints with no body
 * @param success whether the request was carried out
 * @param message a human-readable outcome; never an exception message in production
 * @param data the payload, or {@code null}
 */
public record ApiResponse<T>(boolean success, String message, T data) {

    /**
     * A request that was carried out.
     *
     * @param data the payload
     * @param <T> payload type
     * @return a successful envelope
     */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "ok", data);
    }

    /**
     * A request that was refused, with the reason the caller may be told.
     *
     * @param message the reason
     * @param <T> payload type
     * @return a failed envelope
     */
    public static <T> ApiResponse<T> failure(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
