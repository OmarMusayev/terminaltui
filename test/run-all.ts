#!/usr/bin/env node
/**
 * Unified test runner — discovers test files automatically and reports
 * combined results.
 *
 * Discovery rules (relative to test/):
 *   - test-*.ts                 main suites
 *   - **\/*.test.ts             newer naming convention (incl. router/)
 *
 * Excluded by default (opt-in via flags):
 *   - stress-*.ts            slow harnesses                    (--stress)
 *   - demo-*.test.ts         PTY-driven demo tests             (--demos)
 *   - usability-fresh.ts     manual usability harness          (--all)
 *   - health-check-emulator.ts manual health check             (--all)
 *
 * Always excluded:
 *   - run-all.ts             this runner
 *   - harness.ts             utility, not a test
 *
 * Usage:
 *   npx tsx test/run-all.ts                    # default suite
 *   npx tsx test/run-all.ts --stress           # add stress tests
 *   npx tsx test/run-all.ts --demos            # add demo emulator tests
 *   npx tsx test/run-all.ts --all              # everything
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
}

const args = new Set(process.argv.slice(2));
const includeStress = args.has("--stress") || args.has("--all");
const includeDemos = args.has("--demos") || args.has("--all");
const includeManual = args.has("--all");

const TEST_DIR = "test";
const ALWAYS_EXCLUDE = new Set(["run-all.ts", "harness.ts"]);
const MANUAL_FILES = new Set(["usability-fresh.ts", "health-check-emulator.ts"]);

function discover(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      discover(full, files);
      continue;
    }
    if (!entry.endsWith(".ts")) continue;
    files.push(full);
  }
  return files;
}

function shouldRun(file: string): boolean {
  const rel = relative(TEST_DIR, file);
  const base = rel.split("/").pop()!;

  if (ALWAYS_EXCLUDE.has(base)) return false;
  if (MANUAL_FILES.has(base) && !includeManual) return false;
  if (base.startsWith("stress-") && !includeStress) return false;
  if (base.startsWith("demo-") && base.endsWith(".test.ts") && !includeDemos) return false;

  // Match test-*.ts at any depth, or *.test.ts at any depth
  if (base.startsWith("test-") && base.endsWith(".ts")) return true;
  if (base.endsWith(".test.ts")) return true;

  return false;
}

function prettyName(file: string): string {
  const base = relative(TEST_DIR, file)
    .replace(/\.test\.ts$/, "")
    .replace(/^test-/, "")
    .replace(/\.ts$/, "");
  return base
    .split("/")
    .map(seg => seg.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    .join(" / ");
}

const allFiles = discover(TEST_DIR).sort();
const suites = allFiles.filter(shouldRun).map(file => ({
  name: prettyName(file),
  file,
}));

const results: SuiteResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

console.log("\x1b[1m\n  terminaltui test runner\x1b[0m");
console.log(`  \x1b[2m${suites.length} suites discovered${includeStress ? " +stress" : ""}${includeDemos ? " +demos" : ""}${includeManual ? " +manual" : ""}\x1b[0m\n`);

for (const suite of suites) {
  const start = Date.now();
  process.stdout.write(`  ${suite.name}...`);

  try {
    const output = execSync(`npx tsx ${suite.file}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    const duration = Date.now() - start;
    let passed = 0;
    let failed = 0;

    const totalMatch = output.match(/Total:\s*(\d+)\s*Passed:\s*(\d+)\s*Failed:\s*(\d+)/i);
    const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
    const summaryMatch2 = output.match(/Passed:\s*(\d+).*?Failed:\s*(\d+)/i);

    if (totalMatch) {
      passed = parseInt(totalMatch[2]);
      failed = parseInt(totalMatch[3]);
    } else if (summaryMatch) {
      passed = parseInt(summaryMatch[1]);
      failed = parseInt(summaryMatch[2]);
    } else if (summaryMatch2) {
      passed = parseInt(summaryMatch2[1]);
      failed = parseInt(summaryMatch2[2]);
    } else {
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
    const exitErr = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    const output = (exitErr.stdout ?? "") + (exitErr.stderr ?? "");

    // Try to extract pass/fail counts from the output even though the process
    // exited non-zero. Suites that ran most of their assertions but had a few
    // failures should report the real numbers, not be flattened to "FAILED".
    let passed = 0;
    let failed = 0;
    const totalMatch = output.match(/Total:\s*(\d+)\s*Passed:\s*(\d+)\s*Failed:\s*(\d+)/i);
    const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/i);
    if (totalMatch) {
      passed = parseInt(totalMatch[2]);
      failed = parseInt(totalMatch[3]);
    } else if (summaryMatch) {
      passed = parseInt(summaryMatch[1]);
      failed = parseInt(summaryMatch[2]);
    }

    if (passed === 0 && failed === 0) {
      // Suite crashed before printing a summary — count as a single failure.
      totalFailed++;
      results.push({ name: suite.name, passed: 0, failed: 1, duration });
      console.log(` \x1b[31mFAILED\x1b[0m (${duration}ms)`);
      if (exitErr.stderr) {
        const lines = exitErr.stderr.split("\n").slice(0, 5);
        for (const line of lines) console.log(`    ${line}`);
      }
    } else {
      totalPassed += passed;
      totalFailed += failed || 1;
      results.push({ name: suite.name, passed, failed, duration });
      console.log(` \x1b[31m${passed} passed, ${failed} failed\x1b[0m (${duration}ms)`);
    }
  }
}

console.log("\n  \x1b[2m" + "─".repeat(50) + "\x1b[0m");
if (totalFailed === 0) {
  console.log(`\n  \x1b[32m✓ All tests passed: ${totalPassed} total across ${results.length} suites\x1b[0m\n`);
} else {
  console.log(`\n  \x1b[31m✗ ${totalPassed} passed, ${totalFailed} failed across ${results.length} suites\x1b[0m\n`);
  process.exit(1);
}
