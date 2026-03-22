/**
 * Braille pattern utilities for compact graphical rendering in the terminal.
 */

const BRAILLE_OFFSET = 0x2800;
// Braille dot positions:
// 0 3
// 1 4
// 2 5
// 6 7

export function sparkline(data: number[]): string {
  if (data.length === 0) return "";

  const chars = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  return data.map(v => {
    const idx = Math.round(((v - min) / range) * (chars.length - 1));
    return chars[idx];
  }).join("");
}

export function dotMatrix(text: string): string[] {
  // Simple 3x5 dot matrix font
  const dotFont: Record<string, number[][]> = {
    A: [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    B: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
    C: [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
    D: [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
    E: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
    F: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
    G: [[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
    H: [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    I: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    J: [[0,0,1],[0,0,1],[0,0,1],[1,0,1],[0,1,0]],
    K: [[1,0,1],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    L: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    M: [[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    N: [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
    O: [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    P: [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
    Q: [[0,1,0],[1,0,1],[1,0,1],[1,1,1],[0,1,1]],
    R: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    S: [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
    T: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    U: [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    V: [[1,0,1],[1,0,1],[1,0,1],[0,1,0],[0,1,0]],
    W: [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1]],
    X: [[1,0,1],[1,0,1],[0,1,0],[1,0,1],[1,0,1]],
    Y: [[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
    Z: [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
    " ": [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
  };

  const upper = text.toUpperCase();
  const height = 5;
  const lines: string[] = Array(Math.ceil(height / 4)).fill("");

  // For each pair of rows, combine into braille
  for (let rowPair = 0; rowPair < height; rowPair += 4) {
    let line = "";
    for (const ch of upper) {
      const pattern = dotFont[ch] ?? dotFont[" "]!;
      // Combine columns into braille chars
      for (let col = 0; col < 3; col += 2) {
        let dots = 0;
        for (let r = 0; r < 4 && rowPair + r < height; r++) {
          const row = rowPair + r;
          if (pattern[row]?.[col]) {
            dots |= (1 << [0,1,2,6][r]);
          }
          if (col + 1 < 3 && pattern[row]?.[col + 1]) {
            dots |= (1 << [3,4,5,7][r]);
          }
        }
        line += String.fromCharCode(BRAILLE_OFFSET + dots);
      }
      line += " "; // space between chars
    }
    lines[Math.floor(rowPair / 4)] = line;
  }

  return lines.filter(l => l.length > 0);
}

export function braillePattern(type: "dots" | "diagonal" | "wave" | "crosshatch", width: number, height: number): string[] {
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      let dots = 0;
      switch (type) {
        case "dots":
          dots = (x + y) % 2 === 0 ? 0x01 : 0x08;
          break;
        case "diagonal":
          dots = ((x + y) % 3 === 0) ? 0x09 : ((x + y) % 3 === 1) ? 0x12 : 0x24;
          break;
        case "wave":
          dots = [0x06, 0x09, 0x30, 0x09][(x + y) % 4];
          break;
        case "crosshatch":
          dots = 0x05 | 0x28;
          break;
      }
      line += String.fromCharCode(BRAILLE_OFFSET + dots);
    }
    lines.push(line);
  }

  return lines;
}
