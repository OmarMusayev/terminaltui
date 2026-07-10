/**
 * Code-point-safe cursor helpers shared by the text-editing components
 * (TextInput, TextArea, SearchInput edit handlers).
 *
 * Cursor positions are UTF-16 code-unit indices into the value string, but
 * they must always land on code-point boundaries — never between the two
 * surrogates of an astral-plane character (emoji, rare CJK). These helpers
 * step, snap, and delete by whole code points so editing never tears a
 * surrogate pair into lone-surrogate mojibake.
 */

/** True if the code unit at `index` is a low (trailing) surrogate. */
function isLowSurrogate(value: string, index: number): boolean {
  const code = value.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Snap a cursor onto a code-point boundary (moves left if mid-pair). */
export function snapToCodePoint(value: string, cursor: number): number {
  if (cursor > 0 && cursor < value.length && isLowSurrogate(value, cursor)) return cursor - 1;
  return cursor;
}

/** Cursor position one code point to the left (clamped to 0). */
export function prevCursorPos(value: string, cursor: number): number {
  if (cursor <= 0) return 0;
  const prev = cursor - 1;
  return prev > 0 && isLowSurrogate(value, prev) ? prev - 1 : prev;
}

/** Cursor position one code point to the right (clamped to value.length). */
export function nextCursorPos(value: string, cursor: number): number {
  if (cursor >= value.length) return value.length;
  const cp = value.codePointAt(cursor) ?? 0;
  return cursor + (cp > 0xffff ? 2 : 1);
}

/** Number of code points in a string (for maxLength checks). */
export function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * True if `char` is printable, insertable text with no control characters.
 * KeyPress.char may carry a full surrogate pair (or longer grapheme) — it is
 * treated as an opaque unit and should be inserted whole.
 */
export function isPrintableChar(char: string): boolean {
  if (!char) return false;
  for (const ch of char) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || cp === 0x7f) return false;
  }
  return true;
}
