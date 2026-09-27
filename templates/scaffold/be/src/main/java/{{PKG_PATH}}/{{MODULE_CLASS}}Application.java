package {{BASE_PACKAGE}};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the {{MODULE_DISPLAY}} backend.
 *
 * Everything this service owns lives under {@link {{MODULE_CLASS}}Application}'s
 * package: {@code config} for wiring, {@code web} for the HTTP surface,
 * {@code document} for the domain, {@code storage} for the object-store
 * adapter. The dependencies point inwards — {@code storage} knows about
 * {@code document}, never the other way round — which is what lets the storage
 * adapter be replaced without touching a single domain class.
 *
 * The rules this layout follows are in
 * {@code .docs/project-governance/09-backend/SPRING-BOOT.md}.
 */
@SpringBootApplication
public class {{MODULE_CLASS}}Application {

    public static void main(String[] args) {
        SpringApplication.run({{MODULE_CLASS}}Application.class, args);
    }
}
