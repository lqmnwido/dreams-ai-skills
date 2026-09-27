"use strict";

/**
 * Repository detection.
 *
 * `install.js` must never guess whether it is looking at a brand-new repository
 * or an existing D-ReAMS module, because the intake questions differ: a new
 * repository is asked for its scope, module name, sub-module and use case, while
 * an existing module is pre-filled from what the repository already contains and
 * only asked to confirm.
 *
 * The detection is deliberately evidence-based. Every signal below points at a
 * concrete file or literal that the D-ReAMS platform actually produces, so a
 * wrong verdict is visible in the printed evidence table instead of silently
 * producing a half-filled governance tree.
 */

const fs = require("fs");
const path = require("path");

const FEDERATION_PLUGIN = /new\s+ModuleFederationPlugin\s*\(/;
// `uniqueName: "dreams-mfe-v2t"` is a webpack output option, not a remote name, so
// the match must start at a real property boundary.
const FEDERATION_NAME = /(?:^|[\s,{])name\s*:\s*["'`]([a-z0-9_-]+)["'`]/im;
const UI_DEP = /"@2enapps\/ui"\s*:\s*"([^"]+)"/;

function readIfExists(file, limit = 200000) {
  try {
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    if (stat.size > limit) return fs.readFileSync(file, "utf8").slice(0, limit);
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function safeJson(file) {
  const raw = readIfExists(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { __parseError: err.message };
  }
}

/** Best-effort parse of the env example / env file into a key list. */
function readEnvKeys(cwd) {
  const keys = [];
  const sources = [".env.example", ".env", ".env.development", ".env.production"];
  const found = [];

  for (const name of sources) {
    const raw = readIfExists(path.join(cwd, name));
    if (!raw) continue;
    const local = [];
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match && !local.includes(match[1])) local.push(match[1]);
    }
    found.push({ file: name, keys: local });
    for (const key of local) if (!keys.includes(key)) keys.push(key);
  }

  return { keys, sources: found };
}

/**
 * The `new ModuleFederationPlugin({ ... })` call, and only that.
 *
 * Everything about a remote's public contract is inside this object, and the file
 * around it contains look-alikes: `uniqueName`, `devServer.port`, `publicPath`.
 * Matching those instead of the real thing is how a detector starts confidently
 * reporting the wrong remote name — which is the one value that must never be
 * wrong. So the call is isolated first, with balanced-paren scanning, and every
 * federation read is scoped to it.
 */
function federationBlock(source) {
  if (!source) return "";
  const plugin = FEDERATION_PLUGIN.exec(source);
  if (!plugin) return "";
  const start = plugin.index + plugin[0].length - 1; // the opening paren
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

function detectFederationName(vueConfigSource) {
  const block = federationBlock(vueConfigSource);
  if (!block) return "";
  const match = FEDERATION_NAME.exec(block);
  return match ? match[1] : "";
}

/**
 * The body of `key: { ... }` inside `source`, found with balanced-brace
 * scanning. A non-greedy regex stops at the end of the *first* nested entry, so
 * `shared: { vue: {...}, pinia: {...} }` would only ever yield `vue` — which is
 * exactly the kind of partial answer that makes a singleton check pass.
 */
function objectBlock(source, key) {
  if (!source) return "";
  const start = new RegExp(`(?:^|[\\s,{])${key}\\s*:\\s*\\{`, "m").exec(source);
  if (!start) return "";
  const open = source.indexOf("{", start.index);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

function detectRemoteNames(vueConfigSource) {
  const body = objectBlock(federationBlock(vueConfigSource), "remotes");
  if (!body) return [];
  const names = [];
  const re = /([A-Za-z0-9_-]+)\s*:\s*[`'"][A-Za-z0-9_-]+@/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

function detectExposes(vueConfigSource) {
  const body = objectBlock(federationBlock(vueConfigSource), "exposes");
  if (!body) return [];
  const exposes = [];
  const re = /["'`](\.[^"'`]+)["'`]\s*:\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    exposes.push({ key: match[1], target: match[2] });
  }
  return exposes;
}

/**
 * The `shared` singletons. A second instance of any of these is a runtime
 * failure, not a lint error, so the exact list belongs in the evidence the
 * installer prints and in the governance documents it writes.
 */
function detectShared(vueConfigSource) {
  const body = objectBlock(federationBlock(vueConfigSource), "shared");
  if (!body) return [];
  const names = [];
  const re = /(?:^|[\s,{])["']?([A-Za-z@][A-Za-z0-9_@/.-]*)["']?\s*:\s*[\[{]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

function detectMetadata(cwd) {
  const candidates = [
    "src/metadata.js",
    "src/mfe/metadata.js"
  ];
  for (const rel of candidates) {
    const raw = readIfExists(path.join(cwd, rel));
    if (!raw) continue;
    const pick = (name) => {
      const re = new RegExp(`${name}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`);
      const m = re.exec(raw);
      return m ? m[1] : "";
    };
    const versionMatch = /version\s*:\s*["'`]([^"'`]*)["'`]/.exec(raw);
    const apiVersionMatch = /apiVersion\s*:\s*([0-9]+)/.exec(raw);
    return {
      file: rel,
      remoteName: pick("remoteName"),
      displayName: pick("displayName"),
      version: versionMatch ? versionMatch[1] : "",
      apiVersion: apiVersionMatch ? Number(apiVersionMatch[1]) : "",
      routePrefix: pick("routePrefix"),
      defaultExpose: pick("defaultExpose")
    };
  }
  return null;
}

function countFiles(dir, ext, cap = 5000) {
  let count = 0;
  const stack = [dir];
  while (stack.length && count < cap) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (ext.some((e) => entry.name.endsWith(e))) count++;
    }
  }
  return count;
}

/**
 * Inspect `cwd` and return a structured detection report.
 *
 * `report.kind` is one of:
 *   `new`            — no D-ReAMS evidence at all. Run the new-repository intake.
 *   `shell`          — the federation host (ModuleFederationPlugin name is "shell").
 *   `remote-module`  — a federated frontend module (a non-shell federation name).
 *   `shared-ui`      — the `@2enapps/ui` presentation package.
 *   `backend-api`    — a service that exposes the APIs the platform calls.
 *   `unclassified`   — D-ReAMS-adjacent but ambiguous; the user must choose.
 */
function detect(cwd) {
  const abs = process.cwd() && path.resolve(cwd || ".");
  const evidence = [];

  const pkg = safeJson(path.join(abs, "package.json"));
  const hasPackage = Boolean(pkg && !pkg.__parseError);
  const pkgName = hasPackage ? pkg.name || "" : "";
  const pkgDeps = hasPackage ? { ...(pkg.dependencies || {}) } : {};

  const vueConfig = readIfExists(path.join(abs, "vue.config.js"));
  const hasVueConfig = Boolean(vueConfig);
  const hasFederation = Boolean(vueConfig && FEDERATION_PLUGIN.test(vueConfig));
  const federationName = detectFederationName(vueConfig);
  const shared = detectShared(vueConfig);

  const viteConfig = readIfExists(path.join(abs, "vite.config.js"));
  const uiDepMatch = UI_DEP.exec(readIfExists(path.join(abs, "package.json")) || "");
  const uiDep = uiDepMatch ? uiDepMatch[1] : "";

  const metadata = detectMetadata(abs);
  const env = readEnvKeys(abs);

  const docsDir = path.join(abs, ".docs", "project-governance");
  const docsInstalled = fs.existsSync(docsDir);
  const agentsFile = ["AGENTS.md", "CLAUDE.md", ".cursorrules", "GEMINI.md", ".github/copilot-instructions.md"]
    .map((rel) => ({ rel, exists: fs.existsSync(path.join(abs, rel)) }))
    .filter((entry) => entry.exists);

  if (hasPackage) evidence.push(`package.json → ${pkgName || "(unnamed)"}`);
  if (hasVueConfig) evidence.push("vue.config.js present");
  if (hasFederation) evidence.push(`Module Federation declared as "${federationName || "(unnamed)"}"`);
  if (uiDep) evidence.push(`@2enapps/ui → ${uiDep}`);
  if (metadata) evidence.push(`${metadata.file} → remoteName "${metadata.remoteName}"`);
  if (docsInstalled) evidence.push(".docs/project-governance already present");

  let kind = "unclassified";
  const reasons = [];

  if (hasFederation && federationName === "shell") {
    kind = "shell";
    reasons.push("vue.config.js declares ModuleFederationPlugin with name: \"shell\"");
  } else if (hasFederation && federationName) {
    kind = "remote-module";
    reasons.push(`vue.config.js declares a federated remote named "${federationName}"`);
  } else if (hasPackage && (pkgName === "@2enapps/ui" || (uiDep === "" && /"name"\s*:\s*"@2enapps\/ui"/.test(readIfExists(path.join(abs, "package.json")) || "")))) {
    kind = "shared-ui";
    reasons.push(`package.json name is "${pkgName}"`);
  } else if (hasPackage && !hasVueConfig && !uiDep && hasFederation === false && looksLikeBackend(abs)) {
    kind = "backend-api";
    reasons.push("no Vue CLI entry point and a server framework is present");
  } else if (hasPackage && /^@2enapps\//.test(pkgName) && !hasVueConfig) {
    kind = "remote-module";
    reasons.push(`package.json name "${pkgName}" is a D-ReAMS module without a Vue CLI config`);
  } else if (!hasPackage && !hasVueConfig && !docsInstalled) {
    kind = "new";
    reasons.push("no package.json, no vue.config.js and no existing governance tree");
  }

  if (kind === "unclassified" && looksLikeBackend(abs)) {
    kind = "backend-api";
    reasons.push("a server framework is present");
  }

  const remotes = detectRemoteNames(vueConfig);
  const exposes = detectExposes(vueConfig);

  return {
    cwd: abs,
    kind,
    reasons,
    evidence,
    isNew: kind === "new",
    package: {
      present: hasPackage,
      parseError: hasPackage ? null : pkg && pkg.__parseError ? pkg.__parseError : null,
      name: pkgName,
      version: hasPackage ? pkg.version || "" : "",
      description: hasPackage ? pkg.description || "" : "",
      scripts: hasPackage ? pkg.scripts || {} : {},
      deps: pkgDeps
    },
    federation: {
      present: hasFederation,
      name: federationName,
      exposes,
      remotes,
      shared,
      vueConfig: hasVueConfig,
      viteConfig: Boolean(viteConfig)
    },
    ui: {
      dependency: uiDep,
      installed: Boolean(uiDep),
      isGit: uiDep.startsWith("git+"),
      isFileLink: uiDep.startsWith("file:")
    },
    metadata,
    env,
    docs: {
      installed: docsInstalled,
      dir: path.join(".docs", "project-governance"),
      agentsFiles: agentsFile.map((entry) => entry.rel)
    },
    stats: {
      views: fs.existsSync(path.join(abs, "src")) ? countFiles(path.join(abs, "src"), [".vue"]) : 0,
      js: fs.existsSync(path.join(abs, "src")) ? countFiles(path.join(abs, "src"), [".js", ".ts"]) : 0,
      hasGit: fs.existsSync(path.join(abs, ".git"))
    }
  };
}

function looksLikeBackend(cwd) {
  const manifests = ["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "build.gradle"];
  const frameworks = [
    /"express"/,
    /"fastify"/,
    /"koa"/,
    /"@nestjs\//,
    /"hono"/,
    /^fastapi/im,
    /^flask/im,
    /^django/im,
    /sqlalchemy/i,
    /gorilla\/mux|gin-gonic|gorm/i
  ];

  for (const name of manifests) {
    const raw = readIfExists(path.join(cwd, name));
    if (!raw) continue;
    for (const re of frameworks) if (re.test(raw)) return true;
  }

  return ["main.py", "app.py", "main.go", "server.js", "index.ts", "cmd", "internal"].some((rel) =>
    fs.existsSync(path.join(cwd, rel))
  );
}

module.exports = {
  detect,
  looksLikeBackend,
  readIfExists,
  safeJson,
  federationBlock,
  detectFederationName,
  detectExposes,
  detectRemoteNames,
  detectShared
};
