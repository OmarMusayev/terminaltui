import gradientString from 'gradient-string';
import chalk from 'chalk';

// Force chalk to use truecolor (level 3)
chalk.level = 3;

// Test 1: Simple gradient text
console.log(gradientString('red', 'cyan')('Hello World'));

// Test 2: Multi-line ASCII art with gradient
const banner = [
  ' \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 ',
  '\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
  '\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u2557',
  '\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
  '\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551',
  ' \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d',
].join('\n');

console.log('\n=== gradient-string multiline ===');
console.log(gradientString('red', 'cyan').multiline(banner));

console.log('\n=== gradient-string with 3 colors ===');
console.log(gradientString('#ff6b6b', '#ffd93d', '#4ecdc4').multiline(banner));

// Test 3: Capture raw escape codes
console.log('\n=== RAW ESCAPE CODES (single line) ===');
const simple = gradientString('red', 'cyan')('ABC DEF');
console.log(JSON.stringify(simple));

// Test 4: Capture raw escape codes for multiline
console.log('\n=== RAW ESCAPE CODES (multiline, 2 lines) ===');
const multi = gradientString('red', 'cyan').multiline('AB CD\nEF GH');
console.log(JSON.stringify(multi));

// Test 5: How spaces are handled
console.log('\n=== SPACE HANDLING (single-line) ===');
const spaceTest = gradientString('red', 'cyan')('A   B');
console.log(JSON.stringify(spaceTest));

// Test 6: How spaces are handled in multiline
console.log('\n=== SPACE HANDLING (multiline) ===');
const spaceMulti = gradientString('red', 'cyan').multiline('A   B\nC   D');
console.log(JSON.stringify(spaceMulti));

// Test 7: Unicode block chars
console.log('\n=== UNICODE BLOCK CHARS (multiline) ===');
const blockTest = gradientString('red', 'cyan').multiline('\u2588\u2588 \u2588\u2588\n\u2588\u2588 \u2588\u2588');
console.log(JSON.stringify(blockTest));

// Test 8: Show what chalk.hex produces
console.log('\n=== CHALK HEX ESCAPE CODE SAMPLE ===');
console.log(JSON.stringify(chalk.hex('#ff0000')('X')));
console.log(JSON.stringify(chalk.hex('#00ffff')('Y')));
