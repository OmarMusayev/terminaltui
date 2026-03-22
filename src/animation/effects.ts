import { fgColor, reset } from "../style/colors.js";

const matrixChars = "\uFF8A\uFF90\uFF8B\uFF70\uFF73\uFF7C\uFF85\uFF93\uFF86\uFF7B\uFF9C\uFF82\uFF75\uFF98\uFF71\uFF8E\uFF83\uFF8F\uFF79\uFF92\uFF74\uFF76\uFF77\uFF91\uFF95\uFF97\uFF7E\uFF88\uFF7D\uFF80\uFF87\uFF8D01234567890:;.=+-*/<>[]{}()";

export function matrixRainFrame(width: number, height: number, frame: number): string[] {
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const seed = (x * 7 + y * 13 + frame * 3) % 100;
      if (seed < 15) {
        const charIdx = (x * 31 + y * 17 + frame) % matrixChars.length;
        const brightness = seed < 5 ? "#00ff41" : seed < 10 ? "#008f11" : "#003b00";
        line += fgColor(brightness) + matrixChars[charIdx] + reset;
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }

  return lines;
}

export function glitchText(text: string, intensity: number = 0.1): string {
  const glitchChars = "\u2591\u2592\u2593\u2588\u2580\u2584\u258C\u2590";
  const chars = [...text];

  for (let i = 0; i < chars.length; i++) {
    if (Math.random() < intensity && chars[i] !== " ") {
      chars[i] = glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }
  }

  return chars.join("");
}

export function sparkleText(text: string, frame: number, color: string = "#ffffff"): string {
  const sparkleChars = ["\u2726", "\u2727", "\u22C6", "\u00B7"];
  const chars = [...text];

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === " " && (i + frame) % 7 === 0) {
      chars[i] = fgColor(color) + sparkleChars[frame % sparkleChars.length] + reset;
    }
  }

  return chars.join("");
}
