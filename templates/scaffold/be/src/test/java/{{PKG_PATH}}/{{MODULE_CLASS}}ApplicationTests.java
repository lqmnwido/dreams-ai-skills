package {{BASE_PACKAGE}};

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * The application context must build.
 *
 * This test proves the wiring: every {@code @Configuration}, every bean and the
 * {@code spring.factories} registration all resolve. It does not touch MinIO —
 * the client bean is constructed without opening a connection — so it passes on
 * a machine with no object store running, which is exactly what a fresh
 * checkout needs.
 */
@SpringBootTest
class {{MODULE_CLASS}}ApplicationTests {

    @Test
    void contextLoads() {}
}
