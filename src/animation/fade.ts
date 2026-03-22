import { dim as dimCode, bold as boldCode, reset } from "../style/colors.js";

export type FadePhase = "dim" | "normal" | "bold";

export function getFadeStyle(frame: number, totalFrames: number, direction: "in" | "out" = "in"): string {
  const progress = frame / Math.max(1, totalFrames - 1);
  const t = direction === "in" ? progress : 1 - progress;

  if (t < 0.33) return dimCode;
  if (t < 0.66) return "";
  return boldCode;
}

export function applyFade(text: string, frame: number, totalFrames: number, direction: "in" | "out" = "in"): string {
  const style = getFadeStyle(frame, totalFrames, direction);
  return style + text + reset;
}
