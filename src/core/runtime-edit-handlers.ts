/**
 * Type-specific edit mode key handlers for input components.
 * Each handler manages cursor position and value editing for its input type.
 */
import type {
  TextInputBlock, TextAreaBlock, SelectBlock,
  NumberInputBlock, SearchInputBlock, RadioGroupBlock,
} from "../config/types.js";
import type { KeyPress } from "./input.js";
import { filterSearchItems } from "../components/SearchInput.js";

interface RT {
  inputMode: any;
  getInputState(id: string, defaultValue?: any): any;
  validateInput(block: any): boolean;
  pageFocusNext(): void;
  pageFocusPrev(): void;
}

export function handleTextInputKey(rt: RT, block: TextInputBlock, key: KeyPress): void {
  const state = rt.getInputState(block.id, block.defaultValue ?? "");
  let value = state.value as string;
  let cursor = state.cursorPos;

  if (key.name === "escape") {
    rt.validateInput(block);
    rt.inputMode.exitEdit();
    return;
  }
  if (key.name === "return") {
    rt.validateInput(block);
    rt.inputMode.exitEdit();
    rt.pageFocusNext();
    return;
  }
  if (key.name === "up") {
    rt.validateInput(block);
    rt.inputMode.exitEdit();
    rt.pageFocusPrev();
    return;
  }
  if (key.name === "down") {
    rt.validateInput(block);
    rt.inputMode.exitEdit();
    rt.pageFocusNext();
    return;
  }

  if (key.name === "backspace") {
    if (cursor > 0) {
      value = value.substring(0, cursor - 1) + value.substring(cursor);
      cursor--;
    }
  } else if (key.name === "delete") {
    if (cursor < value.length) {
      value = value.substring(0, cursor) + value.substring(cursor + 1);
    }
  } else if (key.name === "left") {
    if (cursor > 0) cursor--;
  } else if (key.name === "right") {
    if (cursor < value.length) cursor++;
  } else if (key.name === "home") {
    cursor = 0;
  } else if (key.name === "end") {
    cursor = value.length;
  } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
    if (!block.maxLength || value.length < block.maxLength) {
      value = value.substring(0, cursor) + key.char + value.substring(cursor);
      cursor++;
    }
  }

  if (block.transform) {
    value = block.transform(value);
    cursor = Math.min(cursor, value.length);
  }

  const changed = state.value !== value;
  state.value = value;
  state.cursorPos = cursor;
  state.error = null;
  if (changed && block.onChange) block.onChange(value);
}

export function handleTextAreaKey(rt: RT, block: TextAreaBlock, key: KeyPress): void {
  const state = rt.getInputState(block.id, block.defaultValue ?? "");
  let value = state.value as string;
  let cursor = state.cursorPos;

  if (key.name === "escape") {
    rt.validateInput(block);
    rt.inputMode.exitEdit();
    return;
  }

  if (key.name === "return") {
    if (!block.maxLength || value.length < block.maxLength) {
      value = value.substring(0, cursor) + "\n" + value.substring(cursor);
      cursor++;
    }
  } else if (key.name === "backspace") {
    if (cursor > 0) {
      value = value.substring(0, cursor - 1) + value.substring(cursor);
      cursor--;
    }
  } else if (key.name === "delete") {
    if (cursor < value.length) {
      value = value.substring(0, cursor) + value.substring(cursor + 1);
    }
  } else if (key.name === "left") {
    if (cursor > 0) cursor--;
  } else if (key.name === "right") {
    if (cursor < value.length) cursor++;
  } else if (key.name === "up") {
    const lines = value.substring(0, cursor).split("\n");
    if (lines.length > 1) {
      const currentCol = lines[lines.length - 1].length;
      const prevLine = lines[lines.length - 2];
      const newCol = Math.min(currentCol, prevLine.length);
      cursor = lines.slice(0, -1).join("\n").length - prevLine.length + newCol;
      if (cursor < 0) cursor = 0;
    }
  } else if (key.name === "down") {
    const before = value.substring(0, cursor);
    const after = value.substring(cursor);
    const currentLineStart = before.lastIndexOf("\n") + 1;
    const currentCol = cursor - currentLineStart;
    const nextNewline = after.indexOf("\n");
    if (nextNewline >= 0) {
      const afterNext = after.substring(nextNewline + 1);
      const nextLineEnd = afterNext.indexOf("\n");
      const nextLineLen = nextLineEnd >= 0 ? nextLineEnd : afterNext.length;
      const newCol = Math.min(currentCol, nextLineLen);
      cursor = cursor + nextNewline + 1 + newCol;
    }
  } else if (key.name === "home") {
    const before = value.substring(0, cursor);
    cursor = before.lastIndexOf("\n") + 1;
  } else if (key.name === "end") {
    const after = value.substring(cursor);
    const lineEnd = after.indexOf("\n");
    cursor = lineEnd >= 0 ? cursor + lineEnd : value.length;
  } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
    if (!block.maxLength || value.length < block.maxLength) {
      value = value.substring(0, cursor) + key.char + value.substring(cursor);
      cursor++;
    }
  }

  const changed = state.value !== value;
  state.value = value;
  state.cursorPos = cursor;
  state.error = null;
  if (changed && block.onChange) block.onChange(value);
}

export function handleSelectKey(rt: RT, block: SelectBlock, key: KeyPress): void {
  const state = rt.getInputState(block.id, block.defaultValue ?? "");

  if (key.name === "escape") {
    state.open = false;
    rt.inputMode.exitEdit();
    return;
  }

  if (!state.open) {
    if (key.name === "return") {
      state.open = true;
      const idx = block.options.findIndex(o => o.value === state.value);
      state.highlightIndex = idx >= 0 ? idx : 0;
    }
    return;
  }

  if (key.name === "up") {
    state.highlightIndex = Math.max(0, state.highlightIndex - 1);
  } else if (key.name === "down") {
    state.highlightIndex = Math.min(block.options.length - 1, state.highlightIndex + 1);
  } else if (key.name === "return") {
    const opt = block.options[state.highlightIndex];
    if (opt) {
      state.value = opt.value;
      block.onChange?.(opt.value);
    }
    state.open = false;
    rt.inputMode.exitEdit();
  }
}

export function handleNumberInputKey(rt: RT, block: NumberInputBlock, key: KeyPress): void {
  const state = rt.getInputState(block.id, block.defaultValue ?? 0);
  const step = block.step ?? 1;
  const min = block.min ?? -Infinity;
  const max = block.max ?? Infinity;

  if (key.name === "escape") { rt.inputMode.exitEdit(); return; }
  if (key.name === "return" || key.name === "up" || key.name === "down") {
    rt.inputMode.exitEdit();
    if (key.name === "up") rt.pageFocusPrev();
    if (key.name === "down") rt.pageFocusNext();
    return;
  }

  if (key.name === "left" || key.char === "-") {
    state.value = Math.max(min, (state.value as number) - step);
  } else if (key.name === "right" || key.char === "+") {
    state.value = Math.min(max, (state.value as number) + step);
  } else if (key.char && /[0-9]/.test(key.char)) {
    const numStr = String(state.value) === "0" ? key.char : String(state.value) + key.char;
    const num = parseInt(numStr, 10);
    if (!isNaN(num)) state.value = Math.max(min, Math.min(max, num));
  } else if (key.name === "backspace") {
    const numStr = String(state.value).slice(0, -1);
    state.value = numStr ? Math.max(min, Math.min(max, parseInt(numStr, 10) || 0)) : 0;
  }
}

export function handleSearchInputKey(rt: RT, block: SearchInputBlock, key: KeyPress): { action?: "search"; selected?: { label: string; value: string } } {
  const state = rt.getInputState(block.id, "");
  let query = state.value as string;
  let cursor = state.cursorPos;

  if (key.name === "escape") { rt.inputMode.exitEdit(); return {}; }
  if (key.name === "return") {
    const maxResults = block.maxResults ?? 10;
    const filtered = filterSearchItems(block.items, query, maxResults);
    const selected = filtered[state.highlightIndex];
    rt.inputMode.exitEdit();
    if (selected) return { action: "search", selected };
    return {};
  }
  if (key.name === "up") {
    state.highlightIndex = Math.max(0, state.highlightIndex - 1);
    return {};
  }
  if (key.name === "down") {
    const maxResults = block.maxResults ?? 10;
    const filtered = filterSearchItems(block.items, query, maxResults);
    state.highlightIndex = Math.min(filtered.length - 1, state.highlightIndex + 1);
    return {};
  }

  if (key.name === "backspace") {
    if (cursor > 0) { query = query.substring(0, cursor - 1) + query.substring(cursor); cursor--; }
  } else if (key.name === "left") {
    if (cursor > 0) cursor--;
  } else if (key.name === "right") {
    if (cursor < query.length) cursor++;
  } else if (key.char && key.char.length === 1 && !key.ctrl && key.name !== "tab") {
    query = query.substring(0, cursor) + key.char + query.substring(cursor);
    cursor++;
  }

  state.value = query;
  state.cursorPos = cursor;
  state.highlightIndex = 0;
  return {};
}

export function handleRadioGroupKey(rt: RT, block: RadioGroupBlock, key: KeyPress): void {
  const state = rt.getInputState(block.id, block.defaultValue ?? "");

  if (key.name === "escape") { rt.inputMode.exitEdit(); return; }
  if (key.name === "up") {
    if (state.highlightIndex > 0) state.highlightIndex--;
    else { rt.inputMode.exitEdit(); rt.pageFocusPrev(); }
    return;
  }
  if (key.name === "down") {
    if (state.highlightIndex < block.options.length - 1) state.highlightIndex++;
    else { rt.inputMode.exitEdit(); rt.pageFocusNext(); }
    return;
  }
  if (key.name === "return" || key.name === "space") {
    const opt = block.options[state.highlightIndex];
    if (opt) { state.value = opt.value; block.onChange?.(opt.value); }
    return;
  }
}
