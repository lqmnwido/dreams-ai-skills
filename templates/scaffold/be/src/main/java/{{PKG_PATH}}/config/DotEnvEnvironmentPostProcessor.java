package {{BASE_PACKAGE}}.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Loads this repository's {@code .env} as a property source.
 *
 * A module's configuration belongs to the module. The Shell's environment is a
 * different process on a different machine and is not visible here, so this
 * service reads its own {@code .env} — the file that sits next to its
 * {@code pom.xml} and travels with its repository.
 *
 * Three properties matter for correctness:
 *
 * <ul>
 *   <li>{@code addLast} — a real environment variable or a {@code -D} argument
 *       always wins over the file, so production never depends on a file that
 *       should not be deployed there.</li>
 *   <li>{@code LOWEST_PRECEDENCE} — the file is a fallback, not a secret
 *       override layer.</li>
 *   <li>A missing or unreadable file is not fatal. Every property has a default
 *       in {@code application.yml}, so the service starts and the health
 *       endpoint reports the truth rather than crashing on boot.</li>
 * </ul>
 *
 * Registered in {@code META-INF/spring.factories}, which is where
 * {@link SpringApplication} looks for this SPI.
 */
public final class DotEnvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final Logger log = LoggerFactory.getLogger(DotEnvEnvironmentPostProcessor.class);

    private static final String SOURCE_NAME = "moduleDotEnv";

    private static final Path DOT_ENV = Path.of(".env");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!Files.isRegularFile(DOT_ENV)) {
            return;
        }
        Map<String, Object> values = read();
        if (values.isEmpty()) {
            return;
        }
        environment.getPropertySources().addLast(new MapPropertySource(SOURCE_NAME, values));
        log.debug("Loaded {} properties from {}", values.size(), DOT_ENV);
    }

    private Map<String, Object> read() {
        Map<String, Object> values = new LinkedHashMap<>();
        try {
            for (String raw : Files.readAllLines(DOT_ENV, StandardCharsets.UTF_8)) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                putIfValid(values, line);
            }
        } catch (IOException ex) {
            log.warn("Could not read {}: {}", DOT_ENV, ex.getMessage());
            return Map.of();
        }
        return values;
    }

    /**
     * One {@code KEY=value} line. Lines that are not {@code KEY=value}, and keys
     * that would not be legal Java identifiers, are skipped rather than
     * half-parsed — a mangled key produces a property nobody can look up.
     */
    private void putIfValid(Map<String, Object> values, String line) {
        int separator = line.indexOf('=');
        if (separator <= 0) {
            return;
        }
        String key = line.substring(0, separator).trim();
        if (!key.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            return;
        }
        values.put(key, unquote(line.substring(separator + 1).trim()));
    }

    private String unquote(String value) {
        if (value.length() >= 2) {
            boolean doubleQuoted = value.startsWith("\"") && value.endsWith("\"");
            boolean singleQuoted = value.startsWith("'") && value.endsWith("'");
            if (doubleQuoted || singleQuoted) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
