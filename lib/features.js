"use strict";

/**
 * Feature evidence — "does this repository upload documents, and where do the
 * files go?"
 *
 * This is the class of question a governance tree cannot answer by itself and
 * that a human will not remember to ask: a module gains a file input in one
 * commit and an object-storage call in another, and by then nobody can say which
 * bucket production writes to.
 *
 * Everything here is a *signal with an address* — file and line — so the report
 * reads as evidence rather than as an opinion. A signal is never promoted to a
 * conclusion on its own: `MultipartFile` proves an upload endpoint exists, but
 * only a configured bucket proves where the bytes land.
 */

const path = require("path");

const { walkFiles, read } = require("./scan");

const TEXT_FILE = /\.(vue|js|mjs|cjs|ts|tsx|java|xml|yml|yaml|properties|env|example)$/;

const SIGNALS = [
  { id: "java-multipart", re: /\bMultipartFile\b/, what: "Spring multipart upload parameter", kind: "backend" },
  { id: "java-requestpart", re: /@RequestPart\b/, what: "@RequestPart upload argument", kind: "backend" },
  { id: "java-multipart-config", re: /spring\.servlet\.multipart|multipart:\s*$/m, what: "multipart limits configured", kind: "backend" },
  { id: "minio-client", re: /io\.minio|minio\.MinioClient|PutObjectArgs|presignedObjectUrl/, what: "MinIO client usage", kind: "storage" },
  { id: "s3-put", re: /\bputObject\s*\(|PutObjectRequest\b/, what: "object-storage put", kind: "storage" },
  { id: "vue-formdata", re: /new\s+FormData\s*\(/, what: "FormData upload from the browser", kind: "frontend" },
  { id: "vue-fileinput", re: /type\s*=\s*["']file["']/, what: "file input control", kind: "frontend" },
  { id: "vue-multipart", re: /multipart\/form-data/, what: "multipart request header", kind: "frontend" },
  { id: "node-multer", re: /require\(["']multer["']\)|from\s+["']multer["']/, what: "Multer upload middleware", kind: "backend" }
];

/**
 * Where a bucket name is stated.
 *
 * Every pattern is anchored to the start of a line and requires either a
 * quoted value or a `${...:default}` placeholder. The looser version of this
 * that reads `bucket:` anywhere in a line also reads *prose about* buckets — a
 * comment saying "writing to a shared bucket" is not configuration, and
 * reporting it as another module's bucket would send someone looking for a
 * problem that does not exist.
 */
const BUCKET_PATTERNS = [
  /^\s*MINIO_BUCKET\s*=\s*([^\s"'#]+)/im,
  /^\s*bucket\s*:\s*(?:\$\{[^}]*:([^}]+)\}|"([A-Za-z0-9][A-Za-z0-9.-]*)")/im,
  /^\s*String\s+bucket\s*=\s*"([^"]+)"/im,
  /withBucket\s*\(\s*"([^"]+)"\s*\)/
];

function matchLines(source, re) {
  const found = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    if (re.test(lines[i])) found.push(i + 1);
  }
  return found;
}

function detectUploads(root, { max = 400 } = {}) {
  const { files, truncated } = walkFiles(root, (name) => TEXT_FILE.test(name) || name === ".env" || name.startsWith(".env"), { max });
  const signals = [];
  const buckets = new Set();

  for (const file of files) {
    const source = read(file);
    if (source === null) continue;
    const relative = path.relative(root, file).split(path.sep).join("/");

    for (const signal of SIGNALS) {
      const lines = matchLines(source, signal.re);
      if (!lines.length) continue;
      signals.push({ id: signal.id, what: signal.what, kind: signal.kind, file: relative, lines });
    }

    for (const pattern of BUCKET_PATTERNS) {
      const match = pattern.exec(source);
      if (!match) continue;
      const name = match[1] || match[2];
      if (name) buckets.add(name);
    }
  }

  const hasStorage = signals.some((s) => s.kind === "storage");
  const hasUpload = signals.some((s) => s.kind === "backend" || s.kind === "frontend");

  return {
    detected: hasUpload || hasStorage,
    hasUpload,
    hasStorage,
    signals: signals.sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id)),
    buckets: [...buckets].sort(),
    // Storage without an upload path is a dead dependency; an upload path
    // without storage is a feature that loses files. Both are worth saying.
    missing: hasUpload && !hasStorage ? "upload endpoint with no object-storage client" : null,
    scanned: files.length,
    truncated
  };
}

module.exports = { detectUploads, SIGNALS };
