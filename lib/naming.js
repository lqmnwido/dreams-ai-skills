"use strict";

/**
 * Module naming — one module, one source of truth, many derived identifiers.
 *
 * A single module produces several strings, and each one is consumed somewhere
 * a mismatch is a runtime failure rather than a lint error:
 *
 *   Module Demo        display name — menus, titles, documents
 *   module-demo        federation remote name **and** the MinIO bucket
 *   module_demo        snake-case root of the two scaffolded repositories
 *   module_demo_fe     the frontend repository
 *   module_demo_be     the backend repository
 *   ModuleDemo         the Java class prefix
 *   com.dreams.module_demo  the Java package root
 *   VUE_APP_URL_MODULE_DEMO the frontend's own API base env var
 *
 * They are derived rather than asked because a bucket called `module-demo` and a
 * repository called `module_demo_be` can only be kept in step by generating both
 * from one value. Nothing here invents a name: every function is a pure
 * transformation of an answer the user already gave.
 */

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function snake(value) {
  return slugify(value).replace(/-/g, "_");
}

function pascal(value) {
  return snake(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * A Java package segment must be a legal identifier, so a slug that starts with
 * a digit (`2fa`) or that is empty cannot be used as-is. Rather than silently
 * producing code that does not compile, the invalid prefix is stripped and the
 * documented fallback `module` takes its place.
 */
function javaPackageSegment(slug) {
  const cleaned = snake(slug).replace(/^[^a-z]+/, "");
  return cleaned || "module";
}

function basePackage(slug) {
  return `com.dreams.${javaPackageSegment(slug)}`;
}

/** The two repositories a module scaffold creates, from the module slug. */
function repoNames(slug) {
  const root = snake(slug) || "module";
  return {
    frontend: `${root}_fe`,
    backend: `${root}_be`
  };
}

/** The MinIO bucket. Kebab, so it is valid as an S3 object key prefix too. */
function bucketName(slug) {
  return slugify(slug) || "module";
}

/** `module-demo` → `module_demo_fe` / `module_demo_be` / `module-demo`. */
function deriveNames(slug) {
  const repos = repoNames(slug);
  return {
    slug: slugify(slug),
    snake: snake(slug),
    pascal: pascal(slug),
    basePackage: basePackage(slug),
    bucket: bucketName(slug),
    frontendRepo: repos.frontend,
    backendRepo: repos.backend
  };
}

module.exports = {
  slugify,
  snake,
  pascal,
  titleCase,
  javaPackageSegment,
  basePackage,
  repoNames,
  bucketName,
  deriveNames
};
