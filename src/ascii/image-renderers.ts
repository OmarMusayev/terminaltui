/**
 * Image rendering mode implementations: ASCII, braille, blocks, shading.
 * Split from image.ts to keep files under 400 lines.
 */
import { fgColorRgb, reset } from "../style/colors.js";

interface PixelGrid {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
}

const BRAILLE_OFFSET = 0x2800;
const BRAILLE_MAP: [number, number][] = [[0, 3], [1, 4], [2, 5], [6, 7]];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function colorWrap(ch: string, r: number, g: number, b: number): string {
  return fgColorRgb(r, g, b) + ch + reset;
}

function sampleColor(pixels: PixelGrid, x: number, y: number, w: number, h: number): [number, number, number] {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < pixels.width && py < pixels.height) {
        const idx = (py * pixels.width + px) * pixels.channels;
        rSum += pixels.data[idx];
        gSum += pixels.data[idx + 1];
        bSum += pixels.data[idx + 2];
        count++;
      }
    }
  }
  if (count === 0) return [0, 0, 0];
  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

export function renderAscii(
  pixels: PixelGrid, gray: Float64Array, charset: string, useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const v = clamp(gray[y * width + x], 0, 255);
      let ch = charset[Math.round((v / 255) * (charset.length - 1))];
      if (useColor) { const [r, g, b] = sampleColor(pixels, x, y, 1, 1); ch = colorWrap(ch, r, g, b); }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export function renderBraille(
  pixels: PixelGrid, gray: Float64Array, threshold: number, useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];
  for (let by = 0; by < height; by += 4) {
    let line = "";
    for (let bx = 0; bx < width; bx += 2) {
      let code = 0;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const px = bx + col, py = by + row;
          if (px < width && py < height && gray[py * width + px] >= threshold) {
            code |= (1 << BRAILLE_MAP[row][col]);
          }
        }
      }
      let ch = String.fromCharCode(BRAILLE_OFFSET + code);
      if (useColor) { const [r, g, b] = sampleColor(pixels, bx, by, 2, 4); ch = colorWrap(ch, r, g, b); }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export function renderBlocks(
  pixels: PixelGrid, gray: Float64Array, threshold: number, useColor: boolean,
): string[] {
  const { width, height } = pixels;
  const lines: string[] = [];
  for (let y = 0; y < height; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const topOn = gray[y * width + x] >= threshold;
      const botOn = (y + 1) < height ? gray[(y + 1) * width + x] >= threshold : false;
      let ch = topOn && botOn ? "\u2588" : topOn ? "\u2580" : botOn ? "\u2584" : " ";
      if (useColor) { const [r, g, b] = sampleColor(pixels, x, y, 1, 2); ch = colorWrap(ch, r, g, b); }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export function renderShading(
  pixels: PixelGrid, gray: Float64Array, useColor: boolean,
): string[] {
  const shadingChars = " \u00b7:\u2591\u2592\u2593\u2588";
  const { width, height } = pixels;
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const v = clamp(gray[y * width + x], 0, 255);
      let ch = shadingChars[Math.round((v / 255) * (shadingChars.length - 1))];
      if (useColor) { const [r, g, b] = sampleColor(pixels, x, y, 1, 1); ch = colorWrap(ch, r, g, b); }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}
