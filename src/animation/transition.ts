export type TransitionType = "instant" | "fade" | "slide" | "wipe";

export function computeTransition(
  oldLines: string[],
  newLines: string[],
  frame: number,
  totalFrames: number,
  type: TransitionType
): string[] {
  if (type === "instant" || totalFrames <= 1) {
    return newLines;
  }

  const progress = frame / Math.max(1, totalFrames - 1);
  const height = Math.max(oldLines.length, newLines.length);

  switch (type) {
    case "fade": {
      // Crossfade: show old with dim, new with increasing brightness
      if (progress < 0.5) {
        return oldLines;
      }
      return newLines;
    }

    case "slide": {
      // Horizontal slide
      const offset = Math.floor((1 - progress) * 40);
      return newLines.map(line => " ".repeat(offset) + line);
    }

    case "wipe": {
      // Line-by-line wipe from top to bottom
      const revealedLines = Math.floor(progress * height);
      const result: string[] = [];
      for (let i = 0; i < height; i++) {
        if (i < revealedLines) {
          result.push(newLines[i] ?? "");
        } else {
          result.push(oldLines[i] ?? "");
        }
      }
      return result;
    }

    default:
      return newLines;
  }
}

export function getTransitionFrameCount(type: TransitionType, speed: "slow" | "normal" | "fast" = "normal"): number {
  if (type === "instant") return 1;
  const base = { slow: 20, normal: 10, fast: 5 };
  return base[speed];
}
