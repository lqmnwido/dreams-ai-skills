"use strict";

/**
 * MinIO — detection, installation, and the per-module bucket.
 *
 * The platform stores uploaded documents in object storage, and every module
 * gets its own bucket named after its slug (`module-demo`). Two things make this
 * the most easily broken part of the setup:
 *
 *   1. **Nothing here runs without consent.** Installing MinIO starts a daemon
 *      and writes a data directory. The installer therefore only ever does that
 *      after an interactive confirmation or an explicit `--minio=install`; in a
 *      non-interactive run it prints the exact commands instead of guessing that
 *      permission was granted.
 *
 *   2. **A bucket name that disagrees with the module slug** is a silent
 *      mismatch between the service and its clients, so the bucket is always
 *      derived from `MODULE_SLUG` and never typed.
 *
 * The bucket is created with a real SigV4-signed `PUT`, so it works whether
 * MinIO was started by Docker, by a systemd unit, or by hand — no `mc` binary
 * and no second credential store to keep in step.
 */

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");
const path = require("path");

const DEFAULT_ENDPOINT = process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000";
const DEFAULT_CONSOLE = process.env.MINIO_CONSOLE || "http://127.0.0.1:9001";
const DEFAULT_CONTAINER = "dreams-minio";
const DEFAULT_IMAGE = process.env.MINIO_IMAGE || "minio/minio:latest";
const DEFAULT_REGION = "us-east-1";

const CREDENTIALS = {
  accessKey: process.env.MINIO_ROOT_USER || "minioadmin",
  secretKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin"
};

/** Where the server keeps its objects. Outside the repository on purpose — a
 *  data directory inside a git working tree is a directory that ends up
 *  committed, or ends up in `.gitignore` and then lost between machines. */
function defaultDataDir() {
  return path.join(os.homedir(), ".dreams", "minio-data");
}

function run(command, args, { timeout = 20000 } = {}) {
  try {
    const result = spawnSync(command, args, { encoding: "utf8", timeout });
    return {
      ok: result.status === 0 && !result.error,
      status: result.status,
      stdout: String(result.stdout || "").trim(),
      stderr: String(result.stderr || "").trim(),
      error: result.error ? result.error.message : null
    };
  } catch (err) {
    return { ok: false, status: null, stdout: "", stderr: "", error: err.message };
  }
}

function commandExists(name) {
  const probe = process.platform === "win32" ? "where" : "which";
  return run(probe, [name], { timeout: 4000 }).ok;
}

async function healthy(endpoint) {
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, "")}/minio/health/live`, {
      method: "GET",
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Is MinIO there?
 *
 * Reachability is checked first, because it is the only signal that actually
 * matters: a Docker container that exists but is stopped, or a binary on disk
 * that nobody started, does not store anyone's documents. The other probes are
 * reported so the installer can say *how* to start it again.
 */
async function detect({ endpoint = DEFAULT_ENDPOINT } = {}) {
  const report = {
    endpoint,
    consoleUrl: DEFAULT_CONSOLE,
    running: false,
    reason: "unknown",
    docker: false,
    containers: [],
    binary: false,
    image: DEFAULT_IMAGE
  };

  report.running = await healthy(endpoint);
  if (report.running) {
    report.reason = `healthy at ${endpoint}`;
    return report;
  }
  report.reason = `no MinIO answering at ${endpoint}`;

  report.docker = commandExists("docker") && run("docker", ["info"], { timeout: 8000 }).ok;
  if (report.docker) {
    const ps = run("docker", ["ps", "-a", "--format", "{{.Image}}\t{{.Names}}\t{{.Status}}"], { timeout: 8000 });
    if (ps.ok) {
      report.containers = ps.stdout
        .split("\n")
        .map((line) => line.split("\t"))
        .filter(([image]) => /(^|\/)minio/.test(image || ""))
        .map(([image, name, status]) => ({ image, name, status }));
    }
  }

  report.binary = commandExists("minio");
  return report;
}

/** Start a local MinIO in Docker. Only ever called after explicit consent. */
async function install({
  endpoint = DEFAULT_ENDPOINT,
  container = DEFAULT_CONTAINER,
  dataDir = defaultDataDir(),
  image = DEFAULT_IMAGE,
  rootUser = CREDENTIALS.accessKey,
  rootPassword = CREDENTIALS.secretKey
} = {}) {
  if (!commandExists("docker")) {
    return { ok: false, step: "docker", detail: "docker is not installed or not on PATH" };
  }
  const info = run("docker", ["info"], { timeout: 8000 });
  if (!info.ok) {
    return { ok: false, step: "daemon", detail: `docker daemon is not reachable: ${info.stderr || info.error || "unknown"}` };
  }

  const port = new URL(endpoint).port || "9000";
  const consolePort = new URL(DEFAULT_CONSOLE).port || "9001";

  const existing = run("docker", ["inspect", "-f", "{{.State.Running}}", container], { timeout: 8000 });
  if (existing.ok && existing.stdout === "true") {
    return { ok: true, step: "reuse", detail: `container "${container}" is already running`, container, dataDir };
  }
  if (existing.ok) {
    const start = run("docker", ["start", container], { timeout: 30000 });
    if (start.ok) {
      return { ok: true, step: "start", detail: `restarted existing container "${container}"`, container, dataDir };
    }
  }

  const started = run(
    "docker",
    [
      "run",
      "-d",
      "--name",
      container,
      "-p",
      `${port}:9000`,
      "-p",
      `${consolePort}:9001`,
      "-e",
      `MINIO_ROOT_USER=${rootUser}`,
      "-e",
      `MINIO_ROOT_PASSWORD=${rootPassword}`,
      "-v",
      `${dataDir}:/data`,
      image,
      "server",
      "/data",
      "--console-address",
      ":9001"
    ],
    { timeout: 120000 }
  );

  if (!started.ok) {
    return { ok: false, step: "run", detail: started.stderr || started.error || "docker run failed" };
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    if (await healthy(endpoint)) {
      return { ok: true, step: "run", detail: `started "${container}" on ${endpoint}`, container, dataDir };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    ok: false,
    step: "health",
    detail: `container started but ${endpoint}/minio/health/live did not answer within 30s`,
    container,
    dataDir
  };
}

/* ------------------------------------------------------------------ */
/* SigV4 — enough of S3 to create a bucket and a presigned upload path  */
/* ------------------------------------------------------------------ */

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function amzTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function signingKey(secret, stamp) {
  const [date] = stamp.split("T");
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, DEFAULT_REGION);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

/**
 * Sign and send one S3 request.
 *
 * Implemented here rather than pulled in as a dependency because the only
 * operation the installer needs is a `PUT` of zero bytes, and a full AWS SDK is
 * a large, network-fetched, semver-moving dependency to add for it. The signing
 * is the documented AWS Signature Version 4 algorithm.
 */
async function s3Request({ method, endpoint, key = "", payload = "", accessKey, secretKey, region = DEFAULT_REGION, headers = {} }) {
  const url = new URL(endpoint);
  const host = url.host;
  const now = new Date();
  const stamp = amzTimestamp(now);
  const date = stamp.slice(0, 8);
  const payloadHash = sha256Hex(payload);

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${stamp}`,
    ...Object.keys(headers)
      .sort()
      .map((name) => `${name.toLowerCase()}:${String(headers[name])}`)
  ].join("\n");
  const signedHeaders = ["host", "x-amz-content-sha256", "x-amz-date", ...Object.keys(headers).sort().map((n) => n.toLowerCase())].join(";");

  const canonicalRequest = [
    method,
    key ? `/${key}` : "/",
    "",
    canonicalHeaders,
    "",
    signedHeaders,
    payloadHash
  ].join("\n");

  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = crypto
    .createHmac("sha256", signingKey(secretKey, stamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const res = await fetch(`${url.origin}/${key}`, {
    method,
    headers: {
      ...headers,
      "x-amz-date": stamp,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    body: payload || undefined,
    signal: AbortSignal.timeout(8000)
  });

  const text = await res.text().catch(() => "");
  return { ok: res.ok || res.status === 409, status: res.status, body: text };
}

/** Create the module's bucket if it does not exist yet. Idempotent. */
async function ensureBucket(bucket, { endpoint = DEFAULT_ENDPOINT, accessKey = CREDENTIALS.accessKey, secretKey = CREDENTIALS.secretKey } = {}) {
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    return { ok: false, bucket, status: 0, body: `"${bucket}" is not a legal S3 bucket name` };
  }
  try {
    const result = await s3Request({ method: "PUT", endpoint, key: bucket, accessKey, secretKey });
    if (result.ok) return { ok: true, bucket, status: result.status, existed: result.status !== 200 };
    if (result.status === 403) {
      return { ok: false, bucket, status: 403, body: "rejected the local credentials — check MINIO_ROOT_USER / MINIO_ROOT_PASSWORD" };
    }
    return { ok: false, bucket, status: result.status, body: result.body.slice(0, 300) };
  } catch (err) {
    return { ok: false, bucket, status: 0, body: err.message };
  }
}

/** The commands to run by hand, printed when the installer must not act. */
function instructions(bucket, { endpoint = DEFAULT_ENDPOINT, dataDir = defaultDataDir() } = {}) {
  const port = new URL(endpoint).port || "9000";
  return [
    `# endpoint used by the service (MINIO_ENDPOINT): ${endpoint}`,
    `docker run -d --name ${DEFAULT_CONTAINER} \\`,
    `  -p ${port}:9000 -p 9001:9001 \\`,
    `  -e MINIO_ROOT_USER=${CREDENTIALS.accessKey} -e MINIO_ROOT_PASSWORD=${CREDENTIALS.secretKey} \\`,
    `  -v "${dataDir}:/data" ${DEFAULT_IMAGE} server /data --console-address ":9001"`,
    "",
    "# then create this module's bucket (minio/mc, not the server image)",
    `docker run --rm --network host \\`,
    `  -e MC_HOST_local=http://${CREDENTIALS.accessKey}:${CREDENTIALS.secretKey}@127.0.0.1:${port} \\`,
    `  minio/mc mb --ignore-existing local/${bucket}`
  ].join("\n");
}

/**
 * Prove the bucket is writable, not merely present.
 *
 * A bucket that exists and rejects writes is the failure this exists to catch:
 * the service starts, accepts an upload, and fails on the first document, which
 * is the worst moment to find out. One small object is written and removed with
 * the same signing the bucket creation used, so a clean result means the whole
 * path works — credentials, endpoint, bucket policy, all three.
 *
 * The object is left behind if the delete fails, and the message says so rather
 * than reporting success; a probe that cannot clean up after itself has to name
 * the file.
 */
async function probe(bucket, { endpoint = DEFAULT_ENDPOINT, accessKey = CREDENTIALS.accessKey, secretKey = CREDENTIALS.secretKey } = {}) {
  const key = `${bucket}/.dreams-skills-probe`;
  const payload = "dreams-ai-skills write probe\n";
  try {
    const put = await s3Request({ method: "PUT", endpoint, key, payload, accessKey, secretKey });
    if (!put.ok) {
      return { ok: false, key, step: "put", detail: `PUT ${key} returned ${put.status}: ${String(put.body).slice(0, 200)}` };
    }
    const del = await s3Request({ method: "DELETE", endpoint, key, accessKey, secretKey });
    if (del.ok) return { ok: true, key, step: "delete", detail: "wrote and removed a probe object" };
    return {
      ok: false,
      key,
      step: "delete",
      detail: `the probe object ${key} was written but not removed (${del.status}) — delete it by hand`
    };
  } catch (err) {
    return { ok: false, key, step: "probe", detail: err.message };
  }
}

module.exports = {
  DEFAULT_ENDPOINT,
  DEFAULT_CONSOLE,
  DEFAULT_CONTAINER,
  DEFAULT_IMAGE,
  CREDENTIALS,
  defaultDataDir,
  detect,
  install,
  ensureBucket,
  instructions,
  probe,
  healthy
};
