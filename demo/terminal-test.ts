#!/usr/bin/env npx tsx

console.log("\n=== Your Terminal ===");
console.log(`TERM_PROGRAM: ${process.env.TERM_PROGRAM ?? "(not set)"}`);
console.log(`COLORTERM: ${process.env.COLORTERM ?? "(not set)"}`);
console.log(`TERM: ${process.env.TERM ?? "(not set)"}`);

// Test 1: 256-color gradient bar
console.log("\n=== Test 1: 256-color gradient ===");
let line256 = "";
for (let i = 0; i < 40; i++) {
  const colorIdx = Math.floor(i / 40 * 11);
  const colors = [196, 202, 208, 214, 220, 226, 190, 154, 118, 82, 51];
  line256 += `\x1b[38;5;${colors[colorIdx]}m█`;
}
console.log(line256 + "\x1b[0m  ← 256-color");

// Test 2: Truecolor gradient bar
console.log("\n=== Test 2: Truecolor gradient ===");
let lineTc = "";
for (let i = 0; i < 40; i++) {
  const t = i / 39;
  const r = Math.round(255 * (1 - t));
  const g = Math.round(205 * t);
  const b = Math.round(107 + 89 * t);
  lineTc += `\x1b[38;2;${r};0;${b}m█`;
}
console.log(lineTc + "\x1b[0m  ← truecolor");

// Test 3: OMAR banner with 256-color
console.log("\n=== Test 3: OMAR — 256-color ===");
const omar = [
  " ██████╗ ███╗   ███╗ █████╗ ██████╗ ",
  "██╔═══██╗████╗ ████║██╔══██╗██╔══██╗",
  "██║   ██║██╔████╔██║███████║██████╔╝",
  "██║   ██║██║╚██╔╝██║██╔══██║██╔══██╗",
  "╚██████╔╝██║ ╚═╝ ██║██║  ██║██║  ██║",
  " ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝",
];
const c256 = [196, 202, 208, 214, 220, 226, 190, 154, 118, 82, 51];
for (const ln of omar) {
  const chars = [...ln];
  let r = "";
  for (let i = 0; i < chars.length; i++) {
    const ci = Math.min(Math.floor(i / chars.length * c256.length), c256.length - 1);
    r += `\x1b[38;5;${c256[ci]}m${chars[i]}`;
  }
  console.log(r + "\x1b[0m");
}

// Test 4: OMAR banner with truecolor
console.log("\n=== Test 4: OMAR — truecolor ===");
for (const ln of omar) {
  const chars = [...ln];
  let r = "";
  for (let i = 0; i < chars.length; i++) {
    const t = chars.length > 1 ? i / (chars.length - 1) : 0;
    const red = Math.round(255 * (1 - t));
    const grn = Math.round(78 + 142 * t);
    const blu = Math.round(107 + 89 * t);
    r += `\x1b[38;2;${red};${grn};${blu}m${chars[i]}`;
  }
  console.log(r + "\x1b[0m");
}

console.log("\nCompare Test 3 vs Test 4.");
console.log("If 3 looks good but 4 is broken → your terminal lacks truecolor.");
console.log("The framework will auto-detect and use 256-color mode.\n");
