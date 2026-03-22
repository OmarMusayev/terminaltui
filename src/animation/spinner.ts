export type SpinnerStyle = "dots" | "bars" | "braille" | "circle" | "bounce" | "line";

const spinnerFrames: Record<SpinnerStyle, string[]> = {
  dots: ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"],
  bars: ["\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589", "\u2588", "\u2589", "\u258A", "\u258B", "\u258C", "\u258D", "\u258E", "\u258F"],
  braille: ["\u28FE", "\u28FD", "\u28FB", "\u28BF", "\u287F", "\u28DF", "\u28EF", "\u28F7"],
  circle: ["\u25D0", "\u25D3", "\u25D1", "\u25D2"],
  bounce: ["\u2801", "\u2802", "\u2804", "\u2840", "\u2880", "\u2820", "\u2810", "\u2808"],
  line: ["-", "\\", "|", "/"],
};

export function getSpinnerFrame(style: SpinnerStyle, frame: number): string {
  const frames = spinnerFrames[style];
  return frames[frame % frames.length];
}

export function getSpinnerFrames(style: SpinnerStyle): string[] {
  return spinnerFrames[style];
}
