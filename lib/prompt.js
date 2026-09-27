"use strict";

/**
 * Terminal prompting.
 *
 * The installer must work in three situations:
 *
 *   1. an interactive terminal (the normal `npx` run),
 *   2. a pipeline or CI run with no TTY, where prompts are impossible,
 *   3. a partially answered run where every answer came from a CLI flag.
 *
 * In case 2 and 3 the prompter resolves a question to its flag value, then to its
 * derived default, then to a literal "(set me)" — and records it as unanswered.
 * It never invents a plausible answer, and it never blocks waiting for a keypress
 * that will never arrive.
 */

const readline = require("readline");

const UNANSWERED = "(set me)";

const YES_NO = /^(y|yes|n|no|t|f|true|false|1|0)$/i;

/**
 * `--confirm-identity=false` arrives as the string "false", which is truthy — so
 * a confirm question given on the command line has to be coerced, or it silently
 * does the opposite of what was asked.
 */
function normalize(question, value) {
  if (question.type !== "confirm" || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!YES_NO.test(trimmed)) return value;
  return /^(y|yes|t|true|1)$/i.test(trimmed);
}

function createPrompter({ interactive = true, input = process.stdin, output = process.stdout } = {}) {
  let rl = null;
  const asked = [];
  const missing = [];

  function ensureRl() {
    if (!rl) {
      rl = readline.createInterface({ input, output, terminal: Boolean(interactive) });
      if (rl) rl.on("close", () => { rl = null; });
    }
    return rl;
  }

  function isInteractive() {
    return interactive && Boolean(input.isTTY);
  }

  /**
   * A question's text, hint and default may be functions of the answers given so
   * far, so a later question can be phrased in terms of an earlier answer
   * ("Describe the defect" versus "Describe the change").
   */
  function resolve(question, context) {
    const value = (field) => {
      const raw = question[field];
      if (typeof raw === "function") return raw(context);
      return raw;
    };
    return {
      ...question,
      prompt: value("prompt") || "",
      hint: value("hint") || "",
      default: value("default")
    };
  }

  async function line(question) {
    const label = question.hint ? `${question.prompt} (${question.hint})` : question.prompt;
    const suffix = question.default ? ` [${question.default}]` : "";
    if (question.type === "confirm") {
      return askConfirm(question.prompt, Boolean(question.default), label, suffix);
    }
    if (question.type === "multiline") {
      return askMultiline(question, label);
    }
    if (question.type === "choice") {
      return askChoice(question, label, suffix);
    }
    return askText(label, suffix);
  }

  function askText(label, suffix) {
    const iface = ensureRl();
    if (!iface) return Promise.resolve(null);
    return new Promise((resolve) => {
      iface.question(`${label}${suffix}: `, (answer) => resolve(answer.trim()));
    });
  }

  function askConfirm(prompt, fallback, label, suffix) {
    const iface = ensureRl();
    if (!iface) return Promise.resolve(null);
    return new Promise((resolve) => {
      iface.question(`${prompt} ${fallback ? "[Y/n]" : "[y/N]"}${suffix}: `, (answer) => {
        const value = answer.trim().toLowerCase();
        if (value === "") resolve(fallback);
        else resolve(value === "y" || value === "yes");
      });
    });
  }

  function askMultiline(question, label) {
    const iface = ensureRl();
    if (!iface) return Promise.resolve(null);
    const lines = [];
    output.write(`\n  ${label}\n  (one line per point, blank line to finish)\n`);

    return new Promise((resolve) => {
      const onLine = (answer) => {
        if (answer.trim() === "") {
          iface.removeListener("line", onLine);
          iface.prompt();
          resolve(lines);
          return;
        }
        lines.push(answer.trim());
        output.write("  > ");
        iface.prompt();
      };
      iface.on("line", onLine);
      output.write("  > ");
      iface.prompt();
    });
  }

  function askChoice(question, label, suffix) {
    const choices = question.choices || [];
    const defaultIndex = Math.max(0, choices.findIndex((c) => c.id === question.default));

    output.write(`\n  ${label}${suffix || ""}\n`);
    choices.forEach((choice, i) => {
      const marker = i === defaultIndex ? " (default)" : "";
      output.write(`    ${i + 1}) ${choice.label}${marker}`);
      if (choice.hint) output.write(` — ${choice.hint}`);
      output.write("\n");
    });

    const iface = ensureRl();
    if (!iface) return Promise.resolve(null);

    return new Promise((resolve) => {
      iface.question(`  Choose 1-${choices.length} or press enter for the default: `, (answer) => {
        const trimmed = answer.trim();
        if (trimmed === "") {
          resolve(choices[defaultIndex] ? choices[defaultIndex].id : null);
          return;
        }
        if (/^[0-9]+$/.test(trimmed)) {
          const choice = choices[Number(trimmed) - 1];
          if (choice) {
            resolve(choice.id);
            return;
          }
        }
        const byId = choices.find((c) => c.id === trimmed.toLowerCase());
        resolve(byId ? byId.id : null);
      });
    });
  }

  /** Ask a question, applying flag → derived default → prompt → fallback. */
  async function ask(rawQuestion, context) {
    const question = resolve(rawQuestion, context);

    const flagValue = question.flag ? context.flags[question.flag] : undefined;

    if (flagValue !== undefined && flagValue !== "") {
      // A repeatable flag collects several values; a single-value question uses
      // the last one, because that is the one the user corrected it to.
      const repeated = Array.isArray(flagValue) && flagValue.length > 0;
      const value = repeated
        ? question.type === "multiline"
          ? flagValue
          : flagValue[flagValue.length - 1]
        : flagValue;

      if (Array.isArray(value) && !value.length) return unanswered(question.key);

      const final = normalize(question, value);
      asked.push({ key: question.key, source: "flag", value: final });
      return validate(question, final, context);
    }

    if (question.when && !question.when(context)) return undefined;

    const derived = question.default;
    const hasDerived = derived !== undefined && derived !== null && derived !== "";

    if (!isInteractive()) {
      // No TTY: a derived default is a real answer (it is derived from the
      // repository, not guessed), but an absent one is an honest hole.
      if (!hasDerived) return unanswered(question.key);
      asked.push({ key: question.key, source: "derived", value: derived });
      return derived;
    }

    const answer = await line({ ...question, default: hasDerived ? shortDefault(derived) : undefined });
    const value = answer === null || answer === "" ? derived : answer;
    if (value === undefined || value === null || value === "" || value === UNANSWERED) {
      return unanswered(question.key);
    }

    asked.push({ key: question.key, source: "prompt", value });
    return value;
  }

  function unanswered(key) {
    asked.push({ key, source: "unanswered" });
    if (!missing.includes(key)) missing.push(key);
    return undefined;
  }

  function validate(question, value, context) {
    if (!question.validate) return value;
    const result = question.validate(value, context);
    if (result === true) return value;
    output.write(`  ! ${result}\n`);
    return value;
  }

  function close() {
    if (rl) {
      rl.close();
      rl = null;
    }
  }

  return { ask, close, asked, missing, isInteractive, UNANSWERED };
}

function shortDefault(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  if (typeof value === "boolean") return value ? "y" : "n";
  return value;
}

module.exports = { createPrompter, UNANSWERED };
