/**
 * Recorder — captures interactions as replayable scripts.
 */

import type { RecordedAction, RecordedScript } from "./types.js";

export class Recorder {
  private actions: RecordedAction[] = [];
  private startedAt: number = 0;
  private command: string;
  private cols: number;
  private rows: number;
  private recording = false;

  constructor(command: string, cols: number, rows: number) {
    this.command = command;
    this.cols = cols;
    this.rows = rows;
  }

  start(): void {
    this.recording = true;
    this.startedAt = Date.now();
    this.actions = [];
  }

  stop(): RecordedScript {
    this.recording = false;
    return {
      startedAt: this.startedAt,
      actions: [...this.actions],
      command: this.command,
      cols: this.cols,
      rows: this.rows,
    };
  }

  isRecording(): boolean {
    return this.recording;
  }

  recordPress(key: string, times?: number): void {
    if (!this.recording) return;
    this.actions.push({
      type: "press",
      timestamp: Date.now() - this.startedAt,
      data: { key, times },
    });
  }

  recordType(text: string): void {
    if (!this.recording) return;
    this.actions.push({
      type: "type",
      timestamp: Date.now() - this.startedAt,
      data: { text },
    });
  }

  recordWait(condition: string, timeout?: number): void {
    if (!this.recording) return;
    this.actions.push({
      type: "wait",
      timestamp: Date.now() - this.startedAt,
      data: { condition, timeout },
    });
  }

  recordScreenshot(content: string): void {
    if (!this.recording) return;
    this.actions.push({
      type: "screenshot",
      timestamp: Date.now() - this.startedAt,
      data: { content },
    });
  }

  recordAssert(assertion: string, passed: boolean, error?: string): void {
    if (!this.recording) return;
    this.actions.push({
      type: "assert",
      timestamp: Date.now() - this.startedAt,
      data: { assertion, passed, error },
    });
  }

  /** Export as a JSON-serializable script. */
  toJSON(): string {
    return JSON.stringify(this.stop(), null, 2);
  }
}
