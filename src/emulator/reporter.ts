/**
 * Reporter — generates formatted test reports.
 */

import type { TestStep, TestReport } from "./types.js";

export class Reporter {
  private steps: TestStep[] = [];
  private name: string;
  private command: string;
  private cols: number;
  private rows: number;
  private startTime: number;

  constructor(name: string, command: string, cols: number, rows: number) {
    this.name = name;
    this.command = command;
    this.cols = cols;
    this.rows = rows;
    this.startTime = Date.now();
  }

  /** Add a test step result. */
  addStep(name: string, passed: boolean, duration: number, error?: string, screenshot?: string): void {
    this.steps.push({ name, passed, duration, error, screenshot });
  }

  /** Run a test step, catching errors. */
  async runStep(name: string, fn: () => Promise<void> | void): Promise<boolean> {
    const start = Date.now();
    try {
      await fn();
      this.addStep(name, true, Date.now() - start);
      return true;
    } catch (err: any) {
      this.addStep(name, false, Date.now() - start, err.message);
      return false;
    }
  }

  /** Get the final report. */
  getReport(): TestReport {
    const passed = this.steps.filter(s => s.passed).length;
    const failed = this.steps.filter(s => !s.passed).length;
    return {
      name: this.name,
      command: this.command,
      cols: this.cols,
      rows: this.rows,
      steps: this.steps,
      totalDuration: Date.now() - this.startTime,
      passed,
      failed,
    };
  }

  /** Format the report as a colored terminal string. */
  format(): string {
    const report = this.getReport();
    const lines: string[] = [];

    lines.push("");
    lines.push(`\x1b[1m  ${report.name}\x1b[0m`);
    lines.push(`  \x1b[2m${report.command} (${report.cols}x${report.rows})\x1b[0m`);
    lines.push(`  \x1b[2m${"─".repeat(50)}\x1b[0m`);

    for (const step of report.steps) {
      const icon = step.passed ? "\x1b[32m\u2714\x1b[0m" : "\x1b[31m\u2718\x1b[0m";
      const dur = `\x1b[2m(${step.duration}ms)\x1b[0m`;
      lines.push(`  ${icon} ${step.name} ${dur}`);
      if (step.error) {
        lines.push(`    \x1b[31m${step.error}\x1b[0m`);
      }
    }

    lines.push(`  \x1b[2m${"─".repeat(50)}\x1b[0m`);

    const passedStr = `\x1b[32m${report.passed} passed\x1b[0m`;
    const failedStr = report.failed > 0 ? `\x1b[31m${report.failed} failed\x1b[0m` : `0 failed`;
    const totalDur = `\x1b[2m(${report.totalDuration}ms)\x1b[0m`;
    lines.push(`  ${passedStr}, ${failedStr} ${totalDur}`);
    lines.push("");

    return lines.join("\n");
  }
}
