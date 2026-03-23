#!/usr/bin/env node
/**
 * Unified test runner — runs all test suites and reports combined results.
 * Usage: npx tsx test/run-all.ts
 */
import { execSync } from "node:child_process";

interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
}

const suites = [
  { name: "Apple Terminal Colors", file: "test/test-apple-terminal-colors.ts" },
  { name: "Emulator", file: "test/test-emulator.ts" },
  { name: "All Components", file: "test/test-all-components.ts" },
  { name: "State & Reactivity", file: "test/test-state.ts" },
  { name: "Routing & Middleware", file: "test/test-routing-middleware.ts" },
  { name: "Data & Config", file: "test/test-data-config.ts" },
  { name: "Forms", file: "test/test-form.ts" },
  { name: "Async Content", file: "test/test-async.ts" },
  { name: "TextInput", file: "test/test-inputs.ts" },
  { name: "Select & Radio", file: "test/test-select-radio.ts" },
];

const results: SuiteResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

console.log("\x1b[1m\n  terminaltui test runner\n\x1b[0m");

for (const suite of suites) {
  const start = Date.now();
  process.stdout.write(`  Running ${suite.name}...`);

  try {
    const output = execSync(`npx tsx ${suite.file}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60000,
    });

    const duration = Date.now() - start;

    // Parse pass/fail from output
    let passed = 0;
    let failed = 0;

    // Try different output formats
    const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
    const summaryMatch2 = output.match(/Passed:\s*(\d+).*?Failed:\s*(\d+)/i);
    const summaryMatch3 = output.match(/(\d+)\s*passed,\s*(\d+)\s*failed/i);
    const totalMatch = output.match(/Total:\s*(\d+)\s*Passed:\s*(\d+)\s*Failed:\s*(\d+)/i);

    if (totalMatch) {
      passed = parseInt(totalMatch[2]);
      failed = parseInt(totalMatch[3]);
    } else if (summaryMatch) {
      passed = parseInt(summaryMatch[1]);
      failed = parseInt(summaryMatch[2]);
    } else if (summaryMatch2) {
      passed = parseInt(summaryMatch2[1]);
      failed = parseInt(summaryMatch2[2]);
    } else if (summaryMatch3) {
      passed = parseInt(summaryMatch3[1]);
      failed = parseInt(summaryMatch3[2]);
    } else {
      // Count individual pass/fail lines
      passed = (output.match(/✔|PASS|✓/g) ?? []).length;
      failed = (output.match(/✘|FAIL|✗/g) ?? []).length;
    }

    totalPassed += passed;
    totalFailed += failed;
    results.push({ name: suite.name, passed, failed, duration });

    if (failed > 0) {
      console.log(` \x1b[31m${passed} passed, ${failed} failed\x1b[0m (${duration}ms)`);
    } else {
      console.log(` \x1b[32m${passed} passed\x1b[0m (${duration}ms)`);
    }
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const exitErr = err as { status?: number; stdout?: string; stderr?: string };
    totalFailed++;
    results.push({ name: suite.name, passed: 0, failed: 1, duration });
    console.log(` \x1b[31mFAILED\x1b[0m (${duration}ms)`);
    if (exitErr.stderr) {
      const lines = exitErr.stderr.split("\n").slice(0, 5);
      for (const line of lines) console.log(`    ${line}`);
    }
  }
}

// Summary
console.log("\n  \x1b[2m" + "─".repeat(50) + "\x1b[0m");
if (totalFailed === 0) {
  console.log(`\n  \x1b[32m✓ All tests passed: ${totalPassed} total across ${results.length} suites\x1b[0m\n`);
} else {
  console.log(`\n  \x1b[31m✗ ${totalPassed} passed, ${totalFailed} failed across ${results.length} suites\x1b[0m\n`);
  process.exit(1);
}
