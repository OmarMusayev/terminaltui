/**
 * Terminal Width Diagnostic v3 — dead simple.
 * Run: npx tsx diagnose-terminal.ts
 *
 * Each test shows two lines: a row of A's and a row of the test character.
 * If they're the same visual width, the character is 1-cell.
 * If the second line is WIDER, it's rendering as 2-cells.
 */

console.log();
console.log("Terminal Width Diagnostic");
console.log("========================");
console.log();
console.log("Each pair: line 1 = AAAAAAAAAA (10 A's)");
console.log("           line 2 = 10 test chars");
console.log("If line 2 is WIDER than line 1, that char is broken.");
console.log();

const tests: [string, string][] = [
  ["horizontal line", "──────────"],
  ["vertical line  ", "││││││││││"],
  ["rounded corners", "╭╮╰╯╭╮╰╯╭╮"],
  ["double line    ", "══════════"],
  ["full block     ", "██████████"],
  ["light shade    ", "░░░░░░░░░░"],
  ["medium shade   ", "▒▒▒▒▒▒▒▒▒▒"],
  ["dark shade     ", "▓▓▓▓▓▓▓▓▓▓"],
  ["upper half     ", "▀▀▀▀▀▀▀▀▀▀"],
  ["lower half     ", "▄▄▄▄▄▄▄▄▄▄"],
  ["sparkline      ", "▁▂▃▅▆▇▁▂▃▅"],
  ["braille        ", "⠁⠃⠇⡇⣇⣧⣷⣿⠿⠛"],
  ["cursor char    ", "❯❯❯❯❯❯❯❯❯❯"],
  ["diamonds       ", "◆◇◆◇◆◇◆◇◆◇"],
  ["bullets        ", "●○●○●○●○●○"],
  ["stars          ", "★✦✶★✦✶★✦✶★"],
  ["arrows         ", "←→↑↓←→↑↓←→"],
  ["wave           ", "∿∿∿∿∿∿∿∿∿∿"],
  ["slashes        ", "╱╲╱╲╱╲╱╲╱╲"],
];

for (const [label, chars] of tests) {
  console.log(`  ${label}   AAAAAAAAAA`);
  console.log(`  ${" ".repeat(label.length)}   ${chars}`);
  console.log();
}

console.log(`  TERM_PROGRAM = ${process.env.TERM_PROGRAM ?? "(not set)"}`);
console.log();
