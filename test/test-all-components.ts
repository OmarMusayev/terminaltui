/**
 * Comprehensive test for all new input components across all 10 themes.
 *
 * Verifies:
 *  - Each renderer returns a non-empty string[] array
 *  - No line exceeds the specified width (measured with stringWidth)
 *  - No exceptions thrown
 *  - Focused and unfocused states
 *  - Narrow (40), standard (80), and wide (100) widths
 *  - filterSearchItems fuzzy matching
 *
 * Run:  npx tsx test/test-all-components.ts
 * Exit: 0 on all pass, 1 on any failure
 */

import { renderTextInput, type TextInputRenderState } from "../src/components/TextInput.js";
import { renderTextArea, type TextAreaRenderState } from "../src/components/TextArea.js";
import { renderSelect, type SelectRenderState } from "../src/components/Select.js";
import { renderCheckbox } from "../src/components/Checkbox.js";
import { renderToggle } from "../src/components/Toggle.js";
import { renderRadioGroup, type RadioGroupRenderState } from "../src/components/RadioGroup.js";
import { renderNumberInput, type NumberInputRenderState } from "../src/components/NumberInput.js";
import { renderSearchInput, filterSearchItems, type SearchInputRenderState } from "../src/components/SearchInput.js";
import { renderButton } from "../src/components/Button.js";
import { themes, type Theme, type BuiltinThemeName } from "../src/style/theme.js";
import { stringWidth, type RenderContext } from "../src/components/base.js";

import type {
  TextInputBlock,
  TextAreaBlock,
  SelectBlock,
  CheckboxBlock,
  ToggleBlock,
  RadioGroupBlock,
  NumberInputBlock,
  SearchInputBlock,
  ButtonBlock,
} from "../src/config/types.js";

// ─── Test Infrastructure ─────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function pass(name: string): void {
  totalTests++;
  passedTests++;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, reason: string): void {
  totalTests++;
  failedTests++;
  const msg = `  FAIL  ${name} -- ${reason}`;
  console.log(msg);
  failures.push(msg);
}

function makeCtx(width: number, theme: Theme, focused: boolean): RenderContext {
  return { width, theme, focused, borderStyle: "rounded" };
}

// ─── Representative Test Data ────────────────────────────

const textInputConfig: TextInputBlock = {
  type: "textInput",
  id: "username",
  label: "Username",
  placeholder: "Enter your name",
};

const textInputState: TextInputRenderState = {
  value: "omar",
  cursorPos: 4,
  editing: false,
  error: null,
};

const textInputStateEditing: TextInputRenderState = {
  value: "omar",
  cursorPos: 4,
  editing: true,
  error: null,
};

const textInputStateError: TextInputRenderState = {
  value: "",
  cursorPos: 0,
  editing: false,
  error: "Username is required",
};

const textAreaConfig: TextAreaBlock = {
  type: "textArea",
  id: "bio",
  label: "Biography",
  placeholder: "Tell us about yourself",
  rows: 4,
};

const textAreaState: TextAreaRenderState = {
  value: "Hello world\nThis is a bio.",
  cursorPos: 5,
  editing: false,
  error: null,
  scrollOffset: 0,
};

const textAreaStateEditing: TextAreaRenderState = {
  value: "Hello world\nThis is a bio.",
  cursorPos: 5,
  editing: true,
  error: null,
  scrollOffset: 0,
};

const selectConfig: SelectBlock = {
  type: "select",
  id: "language",
  label: "Language",
  options: [
    { label: "TypeScript", value: "ts" },
    { label: "Rust", value: "rust" },
    { label: "Go", value: "go" },
    { label: "Python", value: "py" },
  ],
  placeholder: "Choose a language",
};

const selectStateClosed: SelectRenderState = {
  value: "ts",
  open: false,
  highlightIndex: 0,
};

const selectStateOpen: SelectRenderState = {
  value: "ts",
  open: true,
  highlightIndex: 1,
};

const checkboxConfig: CheckboxBlock = {
  type: "checkbox",
  id: "agree",
  label: "I agree to the terms",
};

const toggleConfig: ToggleBlock = {
  type: "toggle",
  id: "darkMode",
  label: "Dark Mode",
  onLabel: "Enabled",
  offLabel: "Disabled",
};

const radioGroupConfig: RadioGroupBlock = {
  type: "radioGroup",
  id: "plan",
  label: "Choose a plan",
  options: [
    { label: "Free", value: "free" },
    { label: "Pro", value: "pro" },
    { label: "Enterprise", value: "enterprise" },
  ],
};

const radioGroupState: RadioGroupRenderState = {
  value: "pro",
  highlightIndex: 1,
};

const numberInputConfig: NumberInputBlock = {
  type: "numberInput",
  id: "quantity",
  label: "Quantity",
  min: 0,
  max: 100,
  step: 1,
};

const numberInputState: NumberInputRenderState = {
  value: 42,
  editing: false,
  textBuffer: "",
};

const numberInputStateEditing: NumberInputRenderState = {
  value: 42,
  editing: true,
  textBuffer: "42",
};

const searchInputConfig: SearchInputBlock = {
  type: "searchInput",
  id: "search",
  label: "Search Topics",
  placeholder: "Type to search...",
  items: [
    { label: "Rust in Production", value: "rust-prod", keywords: ["systems", "performance"] },
    { label: "TypeScript Tips", value: "ts-tips", keywords: ["javascript", "web"] },
    { label: "Go Concurrency", value: "go-conc", keywords: ["goroutines", "channels"] },
    { label: "Python Data Science", value: "py-ds", keywords: ["pandas", "numpy"] },
    { label: "React Patterns", value: "react", keywords: ["frontend", "hooks"] },
  ],
  onSelect: () => {},
  maxResults: 5,
};

const searchInputState: SearchInputRenderState = {
  query: "",
  cursorPos: 0,
  editing: false,
  highlightIndex: 0,
  filteredItems: searchInputConfig.items.map(i => ({ label: i.label, value: i.value })),
};

const searchInputStateEditing: SearchInputRenderState = {
  query: "rust",
  cursorPos: 4,
  editing: true,
  highlightIndex: 0,
  filteredItems: [{ label: "Rust in Production", value: "rust-prod" }],
};

const buttonConfigPrimary: ButtonBlock = {
  type: "button",
  label: "Submit",
  style: "primary",
};

const buttonConfigSecondary: ButtonBlock = {
  type: "button",
  label: "Cancel",
  style: "secondary",
};

const buttonConfigDanger: ButtonBlock = {
  type: "button",
  label: "Delete",
  style: "danger",
};

// ─── Renderers Under Test ────────────────────────────────

interface ComponentTest {
  name: string;
  render: (ctx: RenderContext) => string[];
}

function buildComponentTests(focused: boolean): ComponentTest[] {
  return [
    {
      name: "TextInput (idle)",
      render: (ctx) => renderTextInput(textInputConfig, textInputState, ctx),
    },
    {
      name: "TextInput (editing)",
      render: (ctx) => renderTextInput(textInputConfig, textInputStateEditing, ctx),
    },
    {
      name: "TextInput (error)",
      render: (ctx) => renderTextInput(textInputConfig, textInputStateError, ctx),
    },
    {
      name: "TextInput (password)",
      render: (ctx) => renderTextInput(
        { ...textInputConfig, mask: true },
        { ...textInputState, value: "secret123" },
        ctx,
      ),
    },
    {
      name: "TextArea (idle)",
      render: (ctx) => renderTextArea(textAreaConfig, textAreaState, ctx),
    },
    {
      name: "TextArea (editing)",
      render: (ctx) => renderTextArea(textAreaConfig, textAreaStateEditing, ctx),
    },
    {
      name: "Select (closed)",
      render: (ctx) => renderSelect(selectConfig, selectStateClosed, ctx),
    },
    {
      name: "Select (open)",
      render: (ctx) => renderSelect(selectConfig, selectStateOpen, ctx),
    },
    {
      name: "Checkbox (unchecked)",
      render: (ctx) => renderCheckbox(checkboxConfig, false, ctx),
    },
    {
      name: "Checkbox (checked)",
      render: (ctx) => renderCheckbox(checkboxConfig, true, ctx),
    },
    {
      name: "Toggle (off)",
      render: (ctx) => renderToggle(toggleConfig, false, ctx),
    },
    {
      name: "Toggle (on)",
      render: (ctx) => renderToggle(toggleConfig, true, ctx),
    },
    {
      name: "RadioGroup",
      render: (ctx) => renderRadioGroup(radioGroupConfig, radioGroupState, ctx),
    },
    {
      name: "NumberInput (idle)",
      render: (ctx) => renderNumberInput(numberInputConfig, numberInputState, ctx),
    },
    {
      name: "NumberInput (editing)",
      render: (ctx) => renderNumberInput(numberInputConfig, numberInputStateEditing, ctx),
    },
    {
      name: "SearchInput (idle)",
      render: (ctx) => renderSearchInput(searchInputConfig, searchInputState, ctx),
    },
    {
      name: "SearchInput (editing)",
      render: (ctx) => renderSearchInput(searchInputConfig, searchInputStateEditing, ctx),
    },
    {
      name: "Button (primary)",
      render: (ctx) => renderButton(buttonConfigPrimary, ctx),
    },
    {
      name: "Button (secondary)",
      render: (ctx) => renderButton(buttonConfigSecondary, ctx),
    },
    {
      name: "Button (danger)",
      render: (ctx) => renderButton(buttonConfigDanger, ctx),
    },
    {
      name: "Button (loading)",
      render: (ctx) => renderButton(buttonConfigPrimary, ctx, true),
    },
  ];
}

// ─── Core Validation ─────────────────────────────────────

function validateRender(
  lines: string[],
  maxWidth: number,
  testLabel: string,
): void {
  // Check non-empty array
  if (!Array.isArray(lines) || lines.length === 0) {
    fail(testLabel, "renderer returned empty or non-array");
    return;
  }

  // Check no line exceeds width (using stringWidth)
  for (let i = 0; i < lines.length; i++) {
    const w = stringWidth(lines[i]);
    if (w > maxWidth) {
      fail(
        testLabel,
        `line ${i} has stringWidth ${w} > max ${maxWidth}: "${lines[i].substring(0, 60)}..."`,
      );
      return;
    }
  }

  pass(testLabel);
}

// ─── Main Test Run ───────────────────────────────────────

const themeNames = Object.keys(themes) as BuiltinThemeName[];
const widths = [40, 80, 100];
const focusStates = [false, true];

console.log("=".repeat(70));
console.log("TEST: All Input Components x All Themes x Widths x Focus States");
console.log("=".repeat(70));

// 1) Render tests across themes, widths, and focus states
for (const themeName of themeNames) {
  const theme = themes[themeName];

  for (const width of widths) {
    for (const focused of focusStates) {
      const focusLabel = focused ? "focused" : "unfocused";
      const tests = buildComponentTests(focused);

      for (const t of tests) {
        const label = `[${themeName}] w=${width} ${focusLabel} | ${t.name}`;
        try {
          const ctx = makeCtx(width, theme, focused);
          const lines = t.render(ctx);
          validateRender(lines, width, label);
        } catch (err: any) {
          fail(label, `threw: ${err.message}`);
        }
      }
    }
  }
}

// 2) filterSearchItems fuzzy matching tests
console.log("\n" + "-".repeat(70));
console.log("TEST: filterSearchItems fuzzy matching");
console.log("-".repeat(70));

const searchItems = searchInputConfig.items;

// "rst" should fuzzy-match "Rust in Production" (r...s...t in order)
{
  const label = 'filterSearchItems: "rst" matches "Rust in Production"';
  try {
    const results = filterSearchItems(searchItems, "rst", 10);
    const found = results.some(r => r.value === "rust-prod");
    if (found) {
      pass(label);
    } else {
      fail(label, `expected "rust-prod" in results, got: ${JSON.stringify(results.map(r => r.value))}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// Empty query returns all items (up to maxResults)
{
  const label = 'filterSearchItems: empty query returns all items';
  try {
    const results = filterSearchItems(searchItems, "", 10);
    if (results.length === searchItems.length) {
      pass(label);
    } else {
      fail(label, `expected ${searchItems.length} results, got ${results.length}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// Exact substring match scores higher
{
  const label = 'filterSearchItems: exact substring "Rust" returns rust-prod first';
  try {
    const results = filterSearchItems(searchItems, "Rust", 10);
    if (results.length > 0 && results[0].value === "rust-prod") {
      pass(label);
    } else {
      fail(label, `expected rust-prod first, got: ${JSON.stringify(results.map(r => r.value))}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// Keyword matching: "goroutines" should match "Go Concurrency"
{
  const label = 'filterSearchItems: keyword "goroutines" matches "Go Concurrency"';
  try {
    const results = filterSearchItems(searchItems, "goroutines", 10);
    const found = results.some(r => r.value === "go-conc");
    if (found) {
      pass(label);
    } else {
      fail(label, `expected "go-conc" in results, got: ${JSON.stringify(results.map(r => r.value))}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// maxResults limits output
{
  const label = 'filterSearchItems: maxResults=2 limits output';
  try {
    const results = filterSearchItems(searchItems, "", 2);
    if (results.length === 2) {
      pass(label);
    } else {
      fail(label, `expected 2 results, got ${results.length}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// No match returns empty
{
  const label = 'filterSearchItems: "zzzzz" returns no results';
  try {
    const results = filterSearchItems(searchItems, "zzzzz", 10);
    if (results.length === 0) {
      pass(label);
    } else {
      fail(label, `expected 0 results, got ${results.length}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// Fuzzy match across keywords: "perf" should match "Rust in Production" via keyword "performance"
{
  const label = 'filterSearchItems: "perf" matches via keyword "performance"';
  try {
    const results = filterSearchItems(searchItems, "perf", 10);
    const found = results.some(r => r.value === "rust-prod");
    if (found) {
      pass(label);
    } else {
      fail(label, `expected "rust-prod" in results, got: ${JSON.stringify(results.map(r => r.value))}`);
    }
  } catch (err: any) {
    fail(label, `threw: ${err.message}`);
  }
}

// ─── Summary ─────────────────────────────────────────────

console.log("\n" + "=".repeat(70));
console.log(`SUMMARY: ${totalTests} total | ${passedTests} passed | ${failedTests} failed`);
console.log("=".repeat(70));

if (failedTests > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(f);
  }
  process.exit(1);
} else {
  console.log("\nAll tests passed.");
  process.exit(0);
}
