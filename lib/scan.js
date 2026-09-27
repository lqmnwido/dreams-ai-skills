"use strict";

/**
 * Bounded source scanning.
 *
 * The installer reads source only to *describe* it — a README route table, an
 * API table, the answer to "does this module upload documents?". It never writes
 * to what it reads, and it stops walking at the first sign of a tree it could
 * not finish: a node_modules, a target, a .git. Every function here returns
 * evidence a human can check, never a conclusion nobody can trace back.
 */

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  "coverage",
  ".git",
  ".docs",
  ".removed",
  "bin",
  "obj"
]);

/**
 * Files under `root` matching `match`, breadth-safe and capped.
 *
 * `max` is a hard stop rather than a filter: a repository large enough to
 * exceed it is a repository where a README table built from a partial read would
 * be wrong in a way nobody notices, so the caller is told instead.
 */
function walkFiles(root, match, { max = 400 } = {}) {
  const found = [];
  let truncated = false;
  const stack = [root];

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!match(entry.name, full)) continue;
      found.push(full);
      if (found.length >= max) {
        truncated = true;
        stack.length = 0;
        break;
      }
    }
  }

  found.sort();
  return { files: found, truncated };
}

function read(file, limit = 500000) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > limit) return null;
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

module.exports = { walkFiles, read, SKIP_DIRS };
