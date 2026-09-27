<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# SPRING-BOOT — {{MODULE_NAME}}

How `{{BACKEND_REPO}}` is built: the layering, the object model, and the Spring
idioms this service uses — with the reason each one is there.

The service exists to give the frontend module one honest API. Everything below
serves that: a shape a reviewer can predict, a dependency direction that never
reverses, and one place where each decision is made.

---

## 1. The shape

```
{{BASE_PACKAGE}}/
├── {{MODULE_CLASS}}Application.java     entry point, and nothing else
├── config/          how the service is wired — .env, properties, client beans
├── web/             the HTTP surface — envelope, exception handling
├── document/        the domain — rules, the storage port, the controller
└── storage/         the object-store adapter — the only class that knows MinIO
```

Dependencies point **inwards**:

```
storage  ──implements──►  document(DocumentStorage)  ◄──calls──  web
   │                            ▲
   └── uses ──► config          └── domain rules live here
```

| Layer | Owns | Must not own |
| --- | --- | --- |
| `web` | status codes, the response envelope, the single exception handler | business rules, logging of business outcomes, `try/catch` |
| `document` | validation, key construction, ownership, the use cases | HTTP, S3, the filesystem, environment variables |
| `storage` | translating the port into S3 calls and S3 failures into domain failures | deciding *whether* an operation is allowed |
| `config` | constructing objects from configuration | behaviour of any kind |

A rule enforced in the wrong layer is enforced only until someone calls the
layer below it directly. `requireOwnedKey` belongs in `DocumentService` because
a second entry point — a message listener, a batch job — must obey it without
remembering to.

---

## 2. Object orientation, concretely

Not "use OOP" — these are the specific choices, each with its counterfactual.

### 2.1 Constructor injection only

```java
public DocumentService(DocumentStorage storage) {
    this.storage = Objects.requireNonNull(storage, "storage");
}
```

`@Autowired` on a field makes the dependency invisible, mutable, and impossible
to satisfy in a unit test without reflection. A constructor makes it a
requirement — a class that cannot be built without its collaborators cannot be
built half-configured.

### 2.2 Records for values

`ApiResponse<T>`, `DocumentResponse`, `DocumentStorage.Stored`,
`StorageProperties`. A value with no identity and no mutation is a record:
equality, immutability and a readable `toString` come for free, and there is no
setter for someone to call at three in the afternoon.

A record is **not** the right answer for a domain entity with a lifecycle. If
`Document` ever gains state transitions, it becomes a class with a private
constructor and named factories.

### 2.3 Interfaces at boundaries, never everywhere

`DocumentStorage` is an interface because there are — and can be — two
implementations: the S3 adapter and the test fake. `DocumentService` is a
concrete class because there is one of it.

An interface with a single production implementation *and* no test fake is
indirection: the reader now holds two names for one behaviour. Add the
abstraction in the commit that needs it (`02-governance/ANTI-SLOP.md` §1.2).

### 2.4 Encapsulation is the default

Fields are `private`; `BASE_PATH` is package-private because the annotation on
its own class references it and nothing else should. Package-private members
that must cross a package boundary get promoted deliberately, in a commit that
says why.

### 2.5 Composition over inheritance

No class in this service extends another. `RuntimeException` and the Spring
annotations are the only inheritance present. A `BaseController` or
`AbstractService` is a guess about future shared behaviour, and guesses in the
class hierarchy are expensive to undo.

---

## 3. The Spring idioms in use

| Pattern | Where | Why it is here |
| --- | --- | --- |
| `@SpringBootApplication` | `{{MODULE_CLASS}}Application` | Composition root only — no logic in `main` |
| `@Configuration` + `@Bean` | `config/StorageConfiguration` | Object construction is configuration, not behaviour |
| `@ConfigurationProperties` record | `config/StorageProperties` | Typed, immutable, one binding site, validated at the point of use |
| `EnvironmentPostProcessor` | `config/DotEnvEnvironmentPostProcessor` | A documented Spring SPI for adding a property source — not a `@PostConstruct` reading files |
| `@RestControllerAdvice` | `web/GlobalExceptionHandler` | One place decides what a failure looks like on the wire |
| `@Service` | `document/DocumentService` | The use cases, transaction boundary when a database arrives |
| `@RestController` | `document/DocumentController` | Translate HTTP ↔ domain; nothing else |
| `@Service` implementing a port | `storage/MinioStorageService` | The adapter, replaceable by annotation |
| `@SpringBootTest` | `{{MODULE_CLASS}}ApplicationTests` | Wiring resolves — no I/O, no fixtures |

What is deliberately **not** used yet: `@Transactional` (no database), JPA
(many-to-many relationships between entities and tables exist only when someone
writes them), `@Async`, `@Scheduled`, profiles. Each is added with the commit
that needs it, together with the failure mode it introduces.

### 3.1 Why `.env` is loaded by an SPI

A module's configuration belongs to the module. The Shell's environment is a
different process, possibly a different machine, and is not visible here.
Spring has no built-in `.env` reader, so `DotEnvEnvironmentPostProcessor` adds
one as a property source, and registers it in `META-INF/spring.factories` —
where `SpringApplication` looks for this SPI.

Three properties make it safe:

- `addLast` — a real environment variable always wins, so production never
  depends on a file that should not be deployed there.
- `LOWEST_PRECEDENCE` — the file is a fallback, not an override layer.
- A missing file is not an error. Every property has a default in
  `application.yml`, so the service starts and reports its health truthfully.

See `03-architecture/INTEGRATION.md` for the rule that the frontend module
points at this service through **its own** `{{API_BASE_ENV}}`, never through a
shared key.

---

## 4. Errors

Three rules:

1. **The domain throws unchecked exceptions it defines.** `StorageException`
   exists because a storage failure is not something a caller can recover from
   by catching it closer to the source.
2. **Adapters translate at the boundary.** `MinioStorageService` converts every
   failure the S3 client can produce into `StorageException`, in one place. Doing
   it per call site produces four messages for one outage.
3. **Controllers do not catch.** `GlobalExceptionHandler` maps each exception
   type to one status code and one body. Adding a `try/catch` in a controller
   means a fifth error shape exists.

The message a caller receives is written for the caller. Internal text — host
names, buckets, file paths, stack traces — goes to the log and never to the
body. That is not obfuscation; it is the difference between an error message
and a disclosure.

---

## 5. Testing

| Layer | Test | Style |
| --- | --- | --- |
| Domain rules | `DocumentServiceTests` | Plain JUnit + AssertJ, an in-memory `DocumentStorage` fake, no Spring |
| Wiring | `{{MODULE_CLASS}}ApplicationTests` | `@SpringBootTest`, context loads, no I/O |
| Adapter | not present at scaffold | When written: a contract test against a real or containerised MinIO |

The fake is a fifteen-line class, not a mocking framework. A mock asserts that
a method was called in an order someone chose; a fake asserts the behaviour the
rule depends on. `06-quality/TESTING.md` owns the broader strategy — this
document only says what the backend's units are.

The service must be testable with no MinIO running. If a unit test needs
object storage, it is testing the adapter from the wrong direction.

---

## 6. Adding to this service

1. **A new use case** → a method on the domain service first, controller second.
   If the method needs three collaborators, it is three use cases.
2. **A new dependency** → check `05-development/TOOLS.md` first; a dependency
   added without an entry there is an unreviewed change.
3. **A new endpoint** → its path goes in a `static final String` referenced by
   the annotation, so the README table (`<!-- api:start -->`) can be generated
   from it and cannot drift.
4. **A new exception type** → it gets a handler in `GlobalExceptionHandler` in
   the same commit, or it returns 500.
5. **A new configuration key** → declared with a default in `application.yml`,
   listed in `.env.example`, and nothing else reads it.

Every one of these ends with `mvn verify`. If the gate is red, the change is
not finished (`05-development/FORMAT-LINT.md` §1).

---

*See also: `03-architecture/API-CONTRACT.md` for the endpoint conventions,
`09-backend/STORAGE.md` for object storage, `05-development/FORMAT-LINT.md` for
the build gate, and `02-governance/ANTI-SLOP.md` for what this service refuses
to contain.*
