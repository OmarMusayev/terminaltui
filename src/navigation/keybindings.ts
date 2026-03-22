import type { KeyPress } from "../core/input.js";

export type Action =
  | "quit"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "home"
  | "command"
  | "tab"
  | "pageUp"
  | "pageDown"
  | "jump1" | "jump2" | "jump3" | "jump4" | "jump5"
  | "jump6" | "jump7" | "jump8" | "jump9";

export function keyToAction(key: KeyPress, isHome: boolean): Action | null {
  // Quit
  if (key.name === "q" && !key.ctrl) return "quit";
  if (key.name === "c" && key.ctrl) return "quit";

  // Back
  if (key.name === "escape") return isHome ? "quit" : "back";
  if (key.name === "backspace") return isHome ? null : "back";
  if (key.name === "left") return isHome ? null : "back";
  if (key.name === "h" && !key.ctrl) return isHome ? null : "back";

  // Navigation
  if (key.name === "up" || key.name === "k") return "up";
  if (key.name === "down" || key.name === "j") return "down";
  if (key.name === "right" || key.name === "l") return "right";

  // Select
  if (key.name === "return") return "select";

  // Command mode
  if (key.char === ":" || key.char === "/") return "command";

  // Tab = next, Shift+Tab = prev
  if (key.name === "tab") return key.shift ? "up" : "down";

  // Home/End — g goes to first, G (shift+g) goes to last
  if (key.char === "g" && !key.shift && !key.ctrl) return "home";
  if (key.char === "G" || (key.char === "g" && key.shift)) return "pageDown"; // G = jump to end

  // Number jumps
  if (key.char >= "1" && key.char <= "9") {
    return `jump${key.char}` as Action;
  }

  return null;
}
