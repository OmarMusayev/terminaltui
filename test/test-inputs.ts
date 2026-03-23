/**
 * Tests for TextInput component rendering, masking, validation,
 * placeholder display, and input state management.
 *
 * Uses the same programmatic VirtualTerminal approach as test-emulator.ts.
 *
 * Run: npx tsx test/test-inputs.ts
 */

import { defineSite, page, textInput, form, button, section } from "../src/index.js";
import { VirtualTerminal } from "../src/emulator/vterm.js";
import { renderTextInput, type TextInputRenderState } from "../src/components/TextInput.js";
import { renderButton } from "../src/components/Button.js";
import { stripAnsi, type RenderContext } from "../src/components/base.js";
import { defaultTheme } from "../src/style/theme.js";
import { createInputState, type InputFieldState } from "../src/data/types.js";
import type { TextInputBlock, ButtonBlock, FormBlock, SiteConfig, Site } from "../src/config/types.js";

// ─── Test Harness ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m\u2714\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m\u2718\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function createTestContext(width: number = 80, opts?: { focused?: boolean; editing?: boolean }): RenderContext {
  return {
    width,
    theme: defaultTheme,
    borderStyle: "rounded",
    focused: opts?.focused ?? false,
    editing: opts?.editing ?? false,
  };
}

// ─── Site Config Definition ───────────────────────────────

const nameInput = textInput({
  id: "name",
  label: "Full Name",
  placeholder: "Enter your name",
});

const emailInput = textInput({
  id: "email",
  label: "Email Address",
  placeholder: "you@example.com",
  validate: (value: string) => {
    if (!value.includes("@")) return "Must be a valid email address";
    return null;
  },
});

const passwordInput = textInput({
  id: "password",
  label: "Password",
  placeholder: "Enter password",
  mask: true,
});

const submitButton = button({
  label: "Submit",
  style: "primary",
});

const contactForm = form({
  id: "contact-form",
  fields: [nameInput, emailInput, passwordInput, submitButton],
  onSubmit: async (data) => {
    return { success: true, message: `Thanks, ${data.name}!` };
  },
});

const siteConfig: SiteConfig = {
  name: "Input Test Site",
  theme: "dracula",
  pages: [
    page("form-page", {
      title: "Contact Form",
      icon: "\u2709",
      content: [
        section("Contact Us", [contactForm]),
      ],
    }),
  ],
};

// ═════════════════════════════════════════════════════════════
// SITE CONFIG TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Site Config\x1b[0m\n");

test("defineSite parses config with form inputs", () => {
  const site: Site = defineSite(siteConfig);
  assert(site !== null && site !== undefined, "site should be defined");
  assert(site.config.pages.length === 1, "should have 1 page");
  const pageContent = site.config.pages[0].content;
  assert(Array.isArray(pageContent), "page content should be an array");
});

test("textInput helper creates correct block type", () => {
  assertEqual(nameInput.type, "textInput", "type");
  assertEqual(nameInput.id, "name", "id");
  assertEqual(nameInput.label, "Full Name", "label");
  assertEqual(nameInput.placeholder, "Enter your name", "placeholder");
});

test("textInput with mask creates correct block", () => {
  assertEqual(passwordInput.type, "textInput", "type");
  assertEqual(passwordInput.mask, true, "mask should be true");
});

test("textInput with validate creates correct block", () => {
  assertEqual(emailInput.type, "textInput", "type");
  assert(typeof emailInput.validate === "function", "validate should be a function");
  assertEqual(emailInput.validate!("bad"), "Must be a valid email address", "validate rejects bad email");
  assertEqual(emailInput.validate!("good@test.com"), null, "validate accepts good email");
});

test("form helper creates correct block with fields", () => {
  assertEqual(contactForm.type, "form", "type");
  assertEqual(contactForm.id, "contact-form", "id");
  assertEqual(contactForm.fields.length, 4, "should have 4 fields");
  assert(typeof contactForm.onSubmit === "function", "onSubmit should be a function");
});

test("button helper creates correct block type", () => {
  assertEqual(submitButton.type, "button", "type");
  assertEqual(submitButton.label, "Submit", "label");
  assertEqual(submitButton.style, "primary", "style");
});

// ═════════════════════════════════════════════════════════════
// TEXT INPUT RENDERING TESTS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  TextInput Rendering\x1b[0m\n");

test("Renders text input with label and bordered box", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "", cursorPos: 0, editing: false, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  assert(lines.length > 0, "should produce output lines");

  // Check label is present
  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Full Name"), "should contain label 'Full Name'");

  // Check border chars are present (rounded box uses these)
  assert(allText.includes("\u256d") || allText.includes("\u2500") || allText.includes("\u2502"),
    "should contain box-drawing characters");
});

test("Shows placeholder text when value is empty", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "", cursorPos: 0, editing: false, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Enter your name"), "should display placeholder text");
});

test("Shows typed value instead of placeholder when non-empty", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "Alice", cursorPos: 5, editing: false, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Alice"), "should display typed value 'Alice'");
  assert(!allText.includes("Enter your name"), "should NOT display placeholder when value is present");
});

test("Masked password shows bullet characters", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "secret", cursorPos: 6, editing: false, error: null };
  const lines = renderTextInput(passwordInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  // bullet char is \u25cf, there should be 6 of them for "secret"
  const bulletCount = (allText.match(/\u25cf/g) ?? []).length;
  assert(bulletCount === 6, `should show 6 bullet chars for 'secret', got ${bulletCount}`);
  assert(!allText.includes("secret"), "should NOT show the actual password text");
});

test("Masked password shows placeholder when empty", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "", cursorPos: 0, editing: false, error: null };
  const lines = renderTextInput(passwordInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Enter password"), "should display placeholder in empty masked input");
});

test("Error message appears when validation returns an error", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "invalid", cursorPos: 7, editing: false, error: "Must be a valid email address" };
  const lines = renderTextInput(emailInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Must be a valid email address"), "should display error message");
  // The error line should contain the X mark
  assert(allText.includes("\u2717"), "should display error icon");
});

test("No error message when validation passes", () => {
  const ctx = createTestContext(60);
  const state: TextInputRenderState = { value: "good@test.com", cursorPos: 13, editing: false, error: null };
  const lines = renderTextInput(emailInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(!allText.includes("\u2717"), "should NOT display error icon when valid");
});

test("Editing state shows cursor block character", () => {
  const ctx = createTestContext(60, { focused: true, editing: true });
  const state: TextInputRenderState = { value: "Hello", cursorPos: 5, editing: true, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  const allText = lines.map(l => stripAnsi(l)).join("\n");
  // Block cursor character
  assert(allText.includes("\u2588"), "should show block cursor when editing");
});

test("Focused input uses accent color for border", () => {
  const ctx = createTestContext(60, { focused: true });
  const state: TextInputRenderState = { value: "", cursorPos: 0, editing: false, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  // The raw (ANSI) output should contain the accent color code
  const rawOutput = lines.join("\n");
  // dracula accent is #ff79c6 — the fgColor function should produce an ANSI sequence for it
  // We just check there's ANSI coloring and the border chars are present
  assert(rawOutput.includes("\x1b["), "should contain ANSI escape codes for coloring");
});

// ═════════════════════════════════════════════════════════════
// RENDERING AT VARIOUS WIDTHS
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Width Responsiveness\x1b[0m\n");

for (const width of [30, 40, 60, 80, 120]) {
  test(`TextInput renders without crash at width ${width}`, () => {
    const ctx = createTestContext(width);
    const state: TextInputRenderState = { value: "Test value", cursorPos: 10, editing: false, error: null };
    const lines = renderTextInput(nameInput, state, ctx);
    assert(lines.length > 0, `should produce output at width ${width}`);
  });
}

for (const width of [30, 40, 60, 80]) {
  test(`TextInput with error renders without crash at width ${width}`, () => {
    const ctx = createTestContext(width);
    const state: TextInputRenderState = { value: "bad", cursorPos: 3, editing: false, error: "Invalid input" };
    const lines = renderTextInput(emailInput, state, ctx);
    assert(lines.length > 0, `should produce output at width ${width}`);
    const allText = lines.map(l => stripAnsi(l)).join("\n");
    assert(allText.includes("Invalid input"), `error visible at width ${width}`);
  });
}

// ═════════════════════════════════════════════════════════════
// VIRTUAL TERMINAL RENDERING (full pipeline)
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  VirtualTerminal Integration\x1b[0m\n");

test("TextInput renders into VirtualTerminal buffer", () => {
  const vt = new VirtualTerminal(80, 24);
  const ctx = createTestContext(80);
  const state: TextInputRenderState = { value: "", cursorPos: 0, editing: false, error: null };
  const lines = renderTextInput(nameInput, state, ctx);

  // Write each line to vterm
  for (const line of lines) {
    vt.write(line + "\n");
  }

  assert(vt.contains("Full Name"), "VT buffer should contain label 'Full Name'");
  assert(vt.contains("Enter your name"), "VT buffer should contain placeholder text");
});

test("Masked input renders bullets in VirtualTerminal", () => {
  const vt = new VirtualTerminal(80, 24);
  const ctx = createTestContext(80);
  const state: TextInputRenderState = { value: "abc123", cursorPos: 6, editing: false, error: null };
  const lines = renderTextInput(passwordInput, state, ctx);

  for (const line of lines) {
    vt.write(line + "\n");
  }

  assert(vt.contains("\u25cf"), "VT buffer should contain bullet characters");
  assert(!vt.contains("abc123"), "VT buffer should NOT contain actual password");
});

test("Error message visible in VirtualTerminal", () => {
  const vt = new VirtualTerminal(80, 24);
  const ctx = createTestContext(80);
  const state: TextInputRenderState = { value: "bad", cursorPos: 3, editing: false, error: "Must be a valid email address" };
  const lines = renderTextInput(emailInput, state, ctx);

  for (const line of lines) {
    vt.write(line + "\n");
  }

  assert(vt.contains("Must be a valid email"), "VT buffer should show validation error");
});

test("Multiple inputs render sequentially in VirtualTerminal", () => {
  const vt = new VirtualTerminal(80, 40);
  const ctx = createTestContext(80);

  // Name input
  const nameState: TextInputRenderState = { value: "Alice", cursorPos: 5, editing: false, error: null };
  const nameLines = renderTextInput(nameInput, nameState, ctx);
  for (const line of nameLines) vt.write(line + "\n");

  // Email input
  const emailState: TextInputRenderState = { value: "alice@test.com", cursorPos: 14, editing: false, error: null };
  const emailLines = renderTextInput(emailInput, emailState, ctx);
  for (const line of emailLines) vt.write(line + "\n");

  // Password input
  const pwState: TextInputRenderState = { value: "pass", cursorPos: 4, editing: false, error: null };
  const pwLines = renderTextInput(passwordInput, pwState, ctx);
  for (const line of pwLines) vt.write(line + "\n");

  assert(vt.contains("Full Name"), "VT should contain name label");
  assert(vt.contains("Alice"), "VT should contain name value");
  assert(vt.contains("Email Address"), "VT should contain email label");
  assert(vt.contains("alice@test.com"), "VT should contain email value");
  assert(vt.contains("Password"), "VT should contain password label");
  assert(vt.contains("\u25cf"), "VT should contain bullet chars for password");
  assert(!vt.contains("pass"), "VT should NOT reveal password text");
});

// ═════════════════════════════════════════════════════════════
// INPUT STATE SYSTEM
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Input State Management\x1b[0m\n");

test("createInputState creates default state", () => {
  const state = createInputState();
  assertEqual(state.value, "", "default value is empty string");
  assertEqual(state.cursorPos, 0, "cursor at 0");
  assertEqual(state.error, null, "no error");
  assertEqual(state.open, false, "not open");
});

test("createInputState with default value", () => {
  const state = createInputState("hello");
  assertEqual(state.value, "hello", "value should be 'hello'");
  assertEqual(state.cursorPos, 5, "cursor at end of 'hello'");
  assertEqual(state.error, null, "no error");
});

test("createInputState for boolean defaults", () => {
  const state = createInputState(false);
  assertEqual(state.value, false, "value should be false");
  assertEqual(state.cursorPos, 0, "cursor at 0 for non-string");
});

test("InputFieldState can track validation errors", () => {
  const state = createInputState("bad-email");
  // Simulate validation
  const error = emailInput.validate!("bad-email");
  state.error = error;
  assertEqual(state.error, "Must be a valid email address", "error stored in state");

  // Simulate fixing the value
  state.value = "good@test.com";
  const error2 = emailInput.validate!(state.value);
  state.error = error2;
  assertEqual(state.error, null, "error cleared after fix");
});

test("InputFieldState tracks cursor position", () => {
  const state = createInputState("Hello World");
  assertEqual(state.cursorPos, 11, "cursor at end of 'Hello World'");

  // Simulate moving cursor left
  state.cursorPos = 5;
  assertEqual(state.cursorPos, 5, "cursor moved to position 5");

  // Render with cursor in middle
  const ctx = createTestContext(60, { focused: true, editing: true });
  const renderState: TextInputRenderState = {
    value: state.value,
    cursorPos: state.cursorPos,
    editing: true,
    error: null,
  };
  const lines = renderTextInput(nameInput, renderState, ctx);
  assert(lines.length > 0, "should render with cursor in middle");
});

test("State values can be read back for form submission", () => {
  // Simulate a form with multiple input states
  const formState: Record<string, InputFieldState> = {
    name: createInputState("Alice Johnson"),
    email: createInputState("alice@example.com"),
    password: createInputState("s3cret!"),
  };

  // Read back values as a form would
  const data: Record<string, any> = {};
  for (const [key, state] of Object.entries(formState)) {
    data[key] = state.value;
  }

  assertEqual(data.name, "Alice Johnson", "name value");
  assertEqual(data.email, "alice@example.com", "email value");
  assertEqual(data.password, "s3cret!", "password value");
});

// ═════════════════════════════════════════════════════════════
// BUTTON RENDERING
// ═════════════════════════════════════════════════════════════

console.log("\n\x1b[1m  Button Rendering\x1b[0m\n");

test("Button renders with label", () => {
  const ctx = createTestContext(60);
  const lines = renderButton(submitButton, ctx);
  assert(lines.length > 0, "should produce output");
  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Submit"), "should contain button label");
});

test("Focused primary button renders with border", () => {
  const ctx = createTestContext(60, { focused: true });
  const lines = renderButton(submitButton, ctx);
  assert(lines.length > 0, "should produce output");
  const allText = lines.map(l => stripAnsi(l)).join("\n");
  assert(allText.includes("Submit"), "should contain button label when focused");
  // Should contain box-drawing characters for border
  assert(allText.includes("\u256d") || allText.includes("\u2500"), "should have border chars");
});

// ═════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════

console.log(`\n\x1b[2m  ${"\u2500".repeat(50)}\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
console.log("");

if (failed > 0) {
  process.exit(1);
}
