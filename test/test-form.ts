/**
 * Form system tests — verifies form helpers, field ID collection,
 * input defaults, state creation, and result rendering.
 */
import {
  defineSite,
  page,
  form,
  textInput,
  textArea,
  checkbox,
  button,
} from "../src/index.js";

import {
  collectFormFieldIds,
  getInputDefault,
  renderFormResult,
} from "../src/components/Form.js";

import { createInputState } from "../src/data/types.js";

import { themes } from "../src/style/theme.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { setColorMode } from "../src/style/colors.js";

setColorMode("256");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2713\x1b[0m ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  \x1b[31m\u2717\x1b[0m ${name}: ${e.message}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const theme = themes.dracula;
function ctx(width = 80): RenderContext {
  return { width, theme, borderStyle: "rounded" };
}

// ─── collectFormFieldIds ──────────────────────────────────

console.log("\n  collectFormFieldIds\n");

test("extracts textInput and textArea IDs", () => {
  const fields = [
    textInput({ id: "name", label: "Name" }),
    textArea({ id: "bio", label: "Bio" }),
    button({ label: "Submit" }),
  ];
  const ids = collectFormFieldIds(fields);
  assert(ids.length === 2, `expected 2 IDs, got ${ids.length}`);
  assert(ids[0] === "name", `expected "name", got "${ids[0]}"`);
  assert(ids[1] === "bio", `expected "bio", got "${ids[1]}"`);
});

test("excludes button from field IDs", () => {
  const fields = [
    textInput({ id: "email", label: "Email" }),
    button({ label: "Go" }),
    button({ label: "Cancel", style: "secondary" }),
  ];
  const ids = collectFormFieldIds(fields);
  assert(ids.length === 1, `expected 1 ID, got ${ids.length}`);
  assert(ids[0] === "email", `expected "email", got "${ids[0]}"`);
});

test("returns empty array for no input fields", () => {
  const fields = [
    button({ label: "Submit" }),
  ];
  const ids = collectFormFieldIds(fields);
  assert(ids.length === 0, `expected 0 IDs, got ${ids.length}`);
});

// ─── getInputDefault ──────────────────────────────────────

console.log("\n  getInputDefault\n");

test("textInput defaults to empty string", () => {
  const block = textInput({ id: "x", label: "X" });
  const val = getInputDefault(block);
  assert(val === "", `expected "", got ${JSON.stringify(val)}`);
});

test("textArea defaults to empty string", () => {
  const block = textArea({ id: "x", label: "X" });
  const val = getInputDefault(block);
  assert(val === "", `expected "", got ${JSON.stringify(val)}`);
});

test("checkbox defaults to false", () => {
  const block = checkbox({ id: "x", label: "X" });
  const val = getInputDefault(block);
  assert(val === false, `expected false, got ${JSON.stringify(val)}`);
});

test("textInput with explicit defaultValue uses it", () => {
  const block = textInput({ id: "x", label: "X", defaultValue: "hello" });
  const val = getInputDefault(block);
  assert(val === "hello", `expected "hello", got ${JSON.stringify(val)}`);
});

test("button returns undefined (not an input)", () => {
  const block = button({ label: "Go" });
  const val = getInputDefault(block);
  assert(val === undefined, `expected undefined, got ${JSON.stringify(val)}`);
});

// ─── createInputState ─────────────────────────────────────

console.log("\n  createInputState\n");

test("creates default state with empty string", () => {
  const state = createInputState();
  assert(state.value === "", `expected "", got ${JSON.stringify(state.value)}`);
  assert(state.cursorPos === 0, `expected cursorPos 0, got ${state.cursorPos}`);
  assert(state.error === null, `expected null error, got ${JSON.stringify(state.error)}`);
  assert(state.open === false, `expected open false`);
  assert(state.highlightIndex === 0, `expected highlightIndex 0`);
  assert(state.scrollOffset === 0, `expected scrollOffset 0`);
});

test("creates state with string default and cursor at end", () => {
  const state = createInputState("hello");
  assert(state.value === "hello", `expected "hello", got ${JSON.stringify(state.value)}`);
  assert(state.cursorPos === 5, `expected cursorPos 5, got ${state.cursorPos}`);
});

test("creates state with boolean default, cursor at 0", () => {
  const state = createInputState(false);
  assert(state.value === false, `expected false, got ${JSON.stringify(state.value)}`);
  assert(state.cursorPos === 0, `expected cursorPos 0 for boolean, got ${state.cursorPos}`);
});

test("creates state with number default, cursor at 0", () => {
  const state = createInputState(42);
  assert(state.value === 42, `expected 42, got ${JSON.stringify(state.value)}`);
  assert(state.cursorPos === 0, `expected cursorPos 0 for number, got ${state.cursorPos}`);
});

// ─── renderFormResult ─────────────────────────────────────

console.log("\n  renderFormResult\n");

test("renders success message with check icon and success color", () => {
  const lines = renderFormResult(
    { resultMessage: "Saved!", resultType: "success" },
    ctx(),
  );
  assert(lines.length > 0, "expected output lines");
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("\u2713"), `expected \u2713 icon in output`);
  assert(plain.includes("Saved!"), `expected message "Saved!" in output`);
});

test("renders error message with cross icon and error color", () => {
  const lines = renderFormResult(
    { resultMessage: "Failed!", resultType: "error" },
    ctx(),
  );
  assert(lines.length > 0, "expected output lines");
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("\u2717"), `expected \u2717 icon in output`);
  assert(plain.includes("Failed!"), `expected message "Failed!" in output`);
});

test("renders info message with info icon", () => {
  const lines = renderFormResult(
    { resultMessage: "Note", resultType: "info" },
    ctx(),
  );
  assert(lines.length > 0, "expected output lines");
  const plain = lines.map(l => stripAnsi(l)).join("\n");
  assert(plain.includes("\u2139"), `expected \u2139 icon in output`);
});

test("returns empty array when no result message", () => {
  const lines = renderFormResult({}, ctx());
  assert(lines.length === 0, `expected 0 lines, got ${lines.length}`);
});

test("success uses theme.success color in ANSI output", () => {
  const lines = renderFormResult(
    { resultMessage: "OK", resultType: "success" },
    ctx(),
  );
  const raw = lines.join("");
  // The raw output should contain ANSI color codes (not just plain text)
  assert(raw.length > stripAnsi(raw).length, "expected ANSI color codes in output");
});

test("error uses theme.error color in ANSI output", () => {
  const lines = renderFormResult(
    { resultMessage: "Err", resultType: "error" },
    ctx(),
  );
  const raw = lines.join("");
  assert(raw.length > stripAnsi(raw).length, "expected ANSI color codes in output");
});

// ─── form() helper ────────────────────────────────────────

console.log("\n  form() helper\n");

test("form block has type 'form'", () => {
  const f = form({
    id: "login",
    fields: [
      textInput({ id: "user", label: "User" }),
      button({ label: "Login" }),
    ],
    onSubmit: async () => ({ success: true, message: "ok" }),
  });
  assert(f.type === "form", `expected type "form", got "${f.type}"`);
});

test("form block has correct id and fields", () => {
  const f = form({
    id: "contact",
    fields: [
      textInput({ id: "name", label: "Name" }),
      textArea({ id: "msg", label: "Message" }),
      button({ label: "Send" }),
    ],
    onSubmit: async () => ({ success: true, message: "sent" }),
  });
  assert(f.id === "contact", `expected id "contact", got "${f.id}"`);
  assert(f.fields.length === 3, `expected 3 fields, got ${f.fields.length}`);
});

test("form tags buttons with _formId", () => {
  const f = form({
    id: "myform",
    fields: [
      textInput({ id: "email", label: "Email" }),
      button({ label: "Submit" }),
      button({ label: "Reset", style: "secondary" }),
    ],
    onSubmit: async () => ({ success: true, message: "done" }),
  });
  for (const field of f.fields) {
    if (field.type === "button") {
      assert(
        (field as any)._formId === "myform",
        `expected _formId "myform", got "${(field as any)._formId}"`,
      );
    }
  }
});

test("form does not tag non-button fields with _formId", () => {
  const f = form({
    id: "myform",
    fields: [
      textInput({ id: "name", label: "Name" }),
      checkbox({ id: "agree", label: "Agree" }),
      button({ label: "Go" }),
    ],
    onSubmit: async () => ({ success: true, message: "" }),
  });
  for (const field of f.fields) {
    if (field.type !== "button") {
      assert(
        (field as any)._formId === undefined,
        `non-button field "${field.type}" should not have _formId`,
      );
    }
  }
});

test("form has an onSubmit handler", () => {
  const handler = async () => ({ success: true, message: "ok" });
  const f = form({
    id: "f1",
    fields: [button({ label: "Go" })],
    onSubmit: handler,
  });
  assert(typeof f.onSubmit === "function", "onSubmit should be a function");
});

// ─── Summary ──────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
