"use strict";

/**
 * Placeholder rendering.
 *
 * Governance documents are written once and then maintained by humans and agents
 * alike. A token the installer could not answer is therefore left visible as
 * `{{TOKEN}}` rather than replaced with an empty string, a guess, or a plausible
 * sentence. An empty substitution produces a document that reads as finished and
 * is not; a visible token is greppable and impossible to mistake for content.
 *
 * `render()` returns the rendered text plus the exact set of unresolved tokens so
 * the installer can report them once, at the end, instead of scattering warnings
 * through the output.
 */

const TOKEN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

/**
 * Tokens that appear in the documents as examples of the convention rather than
 * as values to fill — "never fill a `{{PLACEHOLDER}}` with a guess", "leave a
 * `{{TOKEN}}` visible". They stay in the text on purpose. They must never be
 * listed as unresolved, or every install reports two permanent holes in a list
 * of real ones — and a list with permanent holes in it is a list nobody reads.
 */
const CONVENTION_TOKENS = new Set(["TOKEN", "PLACEHOLDER"]);

function reportable(tokens) {
  return tokens.filter((name) => !CONVENTION_TOKENS.has(name));
}

function collectTokens(text) {
  const found = new Set();
  let match;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text)) !== null) found.add(match[1]);
  return [...found];
}

function render(text, context) {
  const ctx = context || {};
  const unresolved = new Set();

  const out = text.replace(TOKEN, (full, name) => {
    const value = ctx[name];
    if (value === undefined || value === null || value === "") {
      unresolved.add(name);
      return full;
    }
    return String(value);
  });

  return { text: out, unresolved: [...unresolved].sort() };
}

/** Replace every remaining token in a whole tree, collecting a single report. */
function renderTree(files, context) {
  const unresolved = new Set();
  const rendered = {};

  for (const [relativePath, source] of Object.entries(files)) {
    const result = render(source, context);
    rendered[relativePath] = result.text;
    for (const name of result.unresolved) unresolved.add(name);
  }

  return { files: rendered, unresolved: [...unresolved].sort() };
}

module.exports = { render, renderTree, collectTokens, reportable, CONVENTION_TOKENS, TOKEN };
