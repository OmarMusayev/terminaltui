/**
 * Accessors for the real terminal captures in src/data/frames.json.
 *
 * Each frame was produced by booting a demo inside terminaltui's own headless
 * PTY emulator and dumping the colored cell grid as run-length-encoded spans.
 * `html` is therefore trusted, self-generated markup — it is the only place on
 * this site where set:html is appropriate.
 */
import framesJson from "../data/frames.json";

export interface Frame {
  label: string;
  cols: number;
  rows: number;
  /** Newline-separated rows of <span> runs with inline color/background. */
  html: string;
}

const frames = framesJson as unknown as Record<string, Frame[]>;

export const demoKeys = Object.keys(frames);

export function getFrames(demo: string): Frame[] {
  return frames[demo] ?? [];
}

/** A specific capture. Falls back to the demo's first frame, then to null. */
export function getFrame(demo: string, label?: string): Frame | null {
  const list = frames[demo];
  if (!list?.length) return null;
  if (!label) return list[0];
  return list.find((f) => f.label === label) ?? list[0];
}

/** Every frame, flattened, with its demo key attached. */
export function allFrames(): (Frame & { demo: string })[] {
  return Object.entries(frames).flatMap(([demo, list]) =>
    list.map((f) => ({ ...f, demo })),
  );
}

/** Rows actually present in the capture — trailing blank rows were trimmed. */
export function frameRowCount(frame: Frame): number {
  return frame.html.split("\n").length;
}

/** Take the first n rows, for compact previews. */
export function cropFrame(frame: Frame, rows: number): Frame {
  return { ...frame, html: frame.html.split("\n").slice(0, rows).join("\n") };
}
