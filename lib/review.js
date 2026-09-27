"use strict";

/**
 * Human review gates.
 *
 * Every stage of an install is announced before it happens, and a human decides
 * how much of it to make:
 *
 *   1 = Recommended   the platform default
 *   2 = Economy       the same governance, a smaller footprint
 *   3 = Full          everything, including what normally gets added later
 *
 * Two rules keep this honest:
 *
 *   1. **The governance tree is never smaller.** A missing document is not a
 *      lighter install; it is a hole an agent will read as a fact. Economy trims
 *      the scaffold, the README tables and object storage — never the 33
 *      documents, and never a rule inside them. The only thing a level changes
 *      about governance is how much of the result is reported.
 *
 *   2. **A run with nobody to ask never guesses silently.** With no TTY the gate
 *      resolves to `--level`, or Recommended, and prints which one it used and
 *      why. The choice is recorded in `.docs/install.json`, so a later run — or
 *      `check` — can see what a person approved and what a pipeline assumed.
 *
 * The gate is deliberately dumb: it prints what it is told will happen, prints
 * the three consequences, and returns one of three strings. What each level
 * *means* is decided by the step, because only the step knows whether this
 * install has a backend, a scaffold, or a README worth writing to.
 */

const LEVELS = [
  {
    digit: 1,
    id: "recommended",
    label: "Recommended",
    pitch: "the platform default — what the governance documents assume"
  },
  {
    digit: 2,
    id: "economy",
    label: "Economy",
    pitch: "the same 33 documents, a smaller scaffold, no generated tables, no object storage"
  },
  {
    digit: 3,
    id: "full",
    label: "Full",
    pitch: "everything: the wider scaffold, CI, identity questions, the workspace inventory, verified storage"
  }
];

const DEFAULT_LEVEL = "recommended";

const LEVEL_IDS = LEVELS.map((level) => level.id);

/** `"2"`, `"economy"` and `"Economy"` all mean the same gate choice. */
function levelFor(value) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim().toLowerCase();
  const byDigit = LEVELS.find((level) => String(level.digit) === text);
  if (byDigit) return byDigit.id;
  return LEVEL_IDS.includes(text) ? text : null;
}

function digitOf(id) {
  const level = LEVELS.find((entry) => entry.id === id);
  return level ? level.digit : LEVELS[0].digit;
}

function levelInfo(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[0];
}

/**
 * The stages that get a gate, in the order they run.
 *
 * `id` is the same string the choice is recorded under in `install.json`, so a
 * decision can be traced from a document back to the person who made it. `noun`
 * is what the step makes, and is what the gate prints after "This step will".
 */
const STEPS = [
  { id: "detection", title: "1. Detection", noun: "verdict" },
  { id: "intake", title: "2. Intake", noun: "answers" },
  { id: "plan", title: "3. Plan", noun: "plan" },
  { id: "governance", title: "4. Governance", noun: "documents" },
  { id: "scaffold", title: "5. Scaffold", noun: "files" },
  { id: "readme", title: "6. README", noun: "tables" },
  { id: "minio", title: "7. MinIO", noun: "bucket" },
  { id: "result", title: "8. Result", noun: "report" }
];

const STEP_IDS = STEPS.map((step) => step.id);

/**
 * One gate per stage.
 *
 * `step` is `{ id, title, writes, effects, applicable }`:
 *
 *   - `writes`   — what will happen, in the present tense, with real paths and
 *                  counts. Empty lines are dropped rather than printed blank.
 *   - `effects`  — one sentence per level id saying what that choice does here.
 *                  All three are required: a level with no stated consequence is
 *                  a level nobody can choose between.
 *   - `applicable: false` — the step has nothing to do in this run (a
 *                  documentation-only install has no MinIO to reach). The gate
 *                  says why and does not ask, because a question about work that
 *                  is not going to happen is noise dressed as a review.
 */
function createReview({ flags = {}, prompter = null, interactive = true, quiet = false, out = console } = {}) {
  const requested = flags.level;
  const pinned = levelFor(requested);
  const badLevel = requested !== undefined && requested !== "" && !pinned;
  const disabled = Boolean(flags["no-review"]) || quiet;
  const decisions = [];

  function say(line = "") {
    out.log(line);
  }

  function record(id, level, source) {
    const entry = { step: id, level, digit: digitOf(level), source };
    decisions.push(entry);
    return entry;
  }

  function printBlock(step) {
    say("");
    say(`  ── Review · ${step.title} ${"─".repeat(Math.max(0, 56 - step.title.length))}`);
    const writes = (step.writes || []).filter((line) => line && String(line).trim());
    if (writes.length) {
      say("    This step will:");
      for (const line of writes) say(`      · ${line}`);
    }
    say("");
    // The three options are padded to one width so they read as a list of
    // equals. Their consequences are sentences of different lengths; aligning the
    // left edge is what makes the difference between them legible at a glance.
    const labels = LEVELS.map((level) => `${level.digit}) ${level.label}`);
    const width = Math.max(...labels.map((label) => label.length)) + 2;
    for (const [index, level] of LEVELS.entries()) {
      const effect = (step.effects || {})[level.id];
      say(`    ${labels[index].padEnd(width)}${effect ? String(effect) : level.pitch}`);
    }
    say("");
  }

  async function gate(step) {
    const id = step && step.id;
    if (!STEP_IDS.includes(id)) {
      throw new Error(`review gate for an unknown step "${id}" (known: ${STEP_IDS.join(", ")})`);
    }

    const applicable = step.applicable !== false;
    const level = pinned || DEFAULT_LEVEL;

    // `--no-review` and `--quiet` both mean "do not put a question in front of
    // somebody". The level is still recorded, so a later run can tell the
    // difference between a level somebody chose and one a flag implied.
    if (disabled) {
      record(id, level, quiet ? "--quiet" : "--no-review");
      return level;
    }

    if (!applicable) {
      say("");
      say(`  ── Review · ${step.title}`);
      say(`    Skipped: ${step.skipReason || "this step has nothing to do in this run"}`);
      record(id, level, "not applicable");
      return level;
    }

    printBlock(step);

    if (pinned) {
      say(`    → --level=${levelInfo(pinned).id} — using ${levelInfo(pinned).label} for every step.`);
      record(id, pinned, "--level");
      return pinned;
    }

    if (!interactive || !prompter) {
      say(`    → no terminal to ask: using ${levelInfo(level).label}. Pass --level=economy|recommended|full to choose.`);
      record(id, level, "assumed");
      return level;
    }

    // `null` means the terminal went away before anybody answered; `""` means
    // somebody pressed enter, which the prompt offers as Recommended and is
    // therefore a choice. The record has to tell those apart: a run that nobody
    // answered is a different fact from a run somebody accepted a default in.
    const answer = await prompter.askLine("    Choose 1-3, or press enter for Recommended");
    const chosen = levelFor(answer) || level;
    const chosenInfo = levelInfo(chosen);
    if (answer === null) {
      say(`    → nothing was answered: using ${chosenInfo.label}. Pass --level=economy|recommended|full to choose.`);
      record(id, chosen, "assumed");
      return chosen;
    }
    say(`    ✓ ${chosenInfo.label} (${chosenInfo.digit}) — ${chosenInfo.pitch}`);
    record(id, chosen, "asked");
    return chosen;
  }

  /**
   * The record written to `.docs/install.json`.
   *
   * `source` is the interesting field: `asked` means a person answered,
   * `assumed` means a pipeline used the default, and `--level` means a flag
   * pinned it. A governance tree whose install level nobody chose is worth
   * knowing about.
   */
  function summary() {
    return {
      default: DEFAULT_LEVEL,
      levels: LEVELS.map((level) => ({ digit: level.digit, id: level.id, label: level.label })),
      pinned: pinned || null,
      steps: Object.fromEntries(decisions.map((entry) => [entry.step, { level: entry.level, digit: entry.digit, source: entry.source }]))
    };
  }

  return {
    gate,
    summary,
    decisions,
    levels: LEVELS,
    steps: STEPS,
    pinned,
    disabled,
    badLevel
  };
}

module.exports = {
  LEVELS,
  LEVEL_IDS,
  STEPS,
  STEP_IDS,
  DEFAULT_LEVEL,
  levelFor,
  digitOf,
  levelInfo,
  createReview
};
