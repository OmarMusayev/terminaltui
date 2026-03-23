#!/usr/bin/env node
/**
 * TERMINALTUI TETRIS
 *
 * A fully playable Tetris game built with terminaltui's utilities:
 *   - fgColor/bgColor/reset for themed rendering
 *   - themes for the color palette
 *   - createPersistentState for high score persistence
 *   - renderBanner for the ASCII art title
 *   - detectTerminal + setColorMode for Apple Terminal compatibility
 */

import { themes, type Theme } from "../../src/style/theme.js";
import { fgColor, reset, bold, dim, setColorMode } from "../../src/style/colors.js";
import { renderBanner, centerBanner } from "../../src/ascii/banner.js";
import { gradientLines } from "../../src/style/gradient.js";
import { detectTerminal } from "../../src/helpers/detect-terminal.js";
import { createPersistentState } from "../../src/state/persistent.js";

// ─── CONFIG ──────────────────────────────────────────────

const BOARD_W = 10;
const BOARD_H = 20;
const CELL = "\u2588\u2588"; // ██
const GHOST = "\u2591\u2591"; // ░░
const EMPTY = "  ";
const THEME: Theme = themes.cyberpunk;

const PIECE_COLORS: Record<string, string> = {
  I: "#00d4d4",
  O: "#d4d400",
  T: "#9b59b6",
  S: "#2ecc71",
  Z: "#e74c3c",
  J: "#3498db",
  L: "#e67e22",
};

type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

// Each piece: 4 rotations, each rotation is array of [row, col] offsets
const SHAPES: Record<PieceType, number[][][]> = {
  I: [
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ],
  O: [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
};

// ─── PERSISTENT STATE ────────────────────────────────────

const store = createPersistentState({
  path: ".terminaltui/tetris.json",
  defaults: { highScore: 0 },
});

// ─── GAME STATE ──────────────────────────────────────────

interface Piece {
  type: PieceType;
  x: number;
  y: number;
  rotation: number;
}

interface Game {
  board: number[][]; // 0=empty, 1-7 = piece type index+1
  current: Piece;
  next: PieceType;
  hold: PieceType | null;
  holdUsed: boolean;
  score: number;
  level: number;
  lines: number;
  gameOver: boolean;
  paused: boolean;
  screen: "title" | "playing" | "gameover";
  bag: PieceType[];
  flashRows: number[]; // rows currently flashing
  flashFrame: number;
}

function typeIndex(t: PieceType): number {
  return PIECE_TYPES.indexOf(t) + 1;
}

function emptyBoard(): number[][] {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(0));
}

// 7-bag randomizer
function fillBag(): PieceType[] {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function nextFromBag(game: Game): PieceType {
  if (game.bag.length === 0) game.bag = fillBag();
  return game.bag.pop()!;
}

function spawnPiece(type: PieceType): Piece {
  return { type, x: type === "O" ? 4 : 3, y: type === "I" ? -1 : 0, rotation: 0 };
}

function newGame(): Game {
  const bag = fillBag();
  const first = bag.pop()!;
  const next = bag.pop()!;
  return {
    board: emptyBoard(),
    current: spawnPiece(first),
    next,
    hold: null,
    holdUsed: false,
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    paused: false,
    screen: "playing",
    bag,
    flashRows: [],
    flashFrame: 0,
  };
}

// ─── COLLISION ───────────────────────────────────────────

function getCells(piece: Piece): [number, number][] {
  return SHAPES[piece.type][piece.rotation].map(([r, c]) => [piece.y + r, piece.x + c]);
}

function isValid(board: number[][], piece: Piece): boolean {
  for (const [r, c] of getCells(piece)) {
    if (c < 0 || c >= BOARD_W || r >= BOARD_H) return false;
    if (r >= 0 && board[r][c] !== 0) return false;
  }
  return true;
}

// ─── MOVEMENT ────────────────────────────────────────────

function tryMove(game: Game, dx: number, dy: number): boolean {
  const moved = { ...game.current, x: game.current.x + dx, y: game.current.y + dy };
  if (isValid(game.board, moved)) {
    game.current = moved;
    return true;
  }
  return false;
}

function tryRotate(game: Game, dir: 1 | -1): boolean {
  const newRot = ((game.current.rotation + dir) % 4 + 4) % 4;
  const rotated = { ...game.current, rotation: newRot };

  // Try basic rotation
  if (isValid(game.board, rotated)) {
    game.current = rotated;
    return true;
  }

  // Wall kicks: try offsets
  const kicks = [[0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [1, 0], [-1, -1], [-1, 1]];
  for (const [dy, dx] of kicks) {
    const kicked = { ...rotated, x: rotated.x + dx, y: rotated.y + dy };
    if (isValid(game.board, kicked)) {
      game.current = kicked;
      return true;
    }
  }
  return false;
}

function lockPiece(game: Game): void {
  for (const [r, c] of getCells(game.current)) {
    if (r >= 0 && r < BOARD_H && c >= 0 && c < BOARD_W) {
      game.board[r][c] = typeIndex(game.current.type);
    }
  }
}

function clearLines(game: Game): number {
  const fullRows: number[] = [];
  for (let r = 0; r < BOARD_H; r++) {
    if (game.board[r].every(c => c !== 0)) fullRows.push(r);
  }
  if (fullRows.length === 0) return 0;

  // Remove full rows and add empty ones at top
  for (const r of fullRows.sort((a, b) => b - a)) {
    game.board.splice(r, 1);
  }
  while (game.board.length < BOARD_H) {
    game.board.unshift(Array(BOARD_W).fill(0));
  }

  return fullRows.length;
}

function addScore(game: Game, linesCleared: number): void {
  const points = [0, 100, 300, 500, 800];
  game.score += (points[linesCleared] ?? 0) * game.level;
  game.lines += linesCleared;

  // Level up every 10 lines
  const newLevel = Math.floor(game.lines / 10) + 1;
  if (newLevel > game.level) game.level = newLevel;
}

function gravityMs(level: number): number {
  return Math.max(50, 800 - (level - 1) * 75);
}

function spawnNext(game: Game): void {
  game.current = spawnPiece(game.next);
  game.next = nextFromBag(game);
  game.holdUsed = false;

  if (!isValid(game.board, game.current)) {
    game.gameOver = true;
    game.screen = "gameover";
    // Update high score
    if (game.score > store.get("highScore")) {
      store.set("highScore", game.score);
    }
  }
}

function holdPiece(game: Game): void {
  if (game.holdUsed) return;
  game.holdUsed = true;
  const currentType = game.current.type;
  if (game.hold === null) {
    game.hold = currentType;
    spawnNext(game);
  } else {
    const held = game.hold;
    game.hold = currentType;
    game.current = spawnPiece(held);
  }
}

function hardDrop(game: Game): number {
  let rows = 0;
  while (tryMove(game, 0, 1)) rows++;
  return rows;
}

function getGhost(game: Game): Piece {
  const ghost = { ...game.current };
  while (true) {
    const next = { ...ghost, y: ghost.y + 1 };
    if (!isValid(game.board, next)) break;
    ghost.y = next.y;
  }
  return ghost;
}

// ─── TERMINAL ────────────────────────────────────────────

function setup(): void {
  const caps = detectTerminal();
  setColorMode(caps.colorDepth);
  process.stdout.write("\x1b[?1049h"); // alt screen
  process.stdout.write("\x1b[?25l");   // hide cursor
  process.stdout.write("\x1b[2J\x1b[H");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");
}

function cleanup(): void {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\x1b[0m");
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
}

function parseKey(data: string): string | null {
  if (data === "\x1b[A") return "up";
  if (data === "\x1b[B") return "down";
  if (data === "\x1b[C") return "right";
  if (data === "\x1b[D") return "left";
  if (data === " ") return "space";
  if (data === "\r" || data === "\n") return "enter";
  if (data === "\x1b") return "escape";
  if (data === "\x03") return "ctrlc";
  if (data.length === 1) return data.toLowerCase();
  return null;
}

// ─── RENDERING ───────────────────────────────────────────

const TH = THEME;
const accent = (s: string) => fgColor(TH.accent) + s + reset;
const muted = (s: string) => fgColor(TH.muted) + s + reset;
const subtle = (s: string) => fgColor(TH.subtle) + dim + s + reset;
const success = (s: string) => fgColor(TH.success) + s + reset;
const error = (s: string) => fgColor(TH.error) + s + reset;
const border = (s: string) => fgColor(TH.border) + s + reset;

function colorCell(typeIdx: number): string {
  if (typeIdx === 0) return EMPTY;
  const type = PIECE_TYPES[typeIdx - 1];
  return fgColor(PIECE_COLORS[type]) + CELL + reset;
}

function ghostCell(typeIdx: number): string {
  const type = PIECE_TYPES[typeIdx - 1];
  return fgColor(PIECE_COLORS[type]) + dim + GHOST + reset;
}

function renderMiniPiece(type: PieceType | null): string[] {
  if (!type) return [
    border("\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"),
    border("\u2502") + "        " + border("\u2502"),
    border("\u2502") + " (none) " + border("\u2502"),
    border("\u2502") + "        " + border("\u2502"),
    border("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"),
  ];

  // Render piece in a 4x4 grid, show only the non-empty rows
  const cells = SHAPES[type][0];
  const grid: boolean[][] = Array.from({ length: 4 }, () => Array(4).fill(false));
  for (const [r, c] of cells) grid[r][c] = true;

  // Find bounding rows
  let minR = 4, maxR = -1;
  for (const [r] of cells) {
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }

  const color = fgColor(PIECE_COLORS[type]);
  const lines: string[] = [border("\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510")];

  // Pad to 3 content rows
  const contentRows: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    let row = "";
    for (let c = 0; c < 4; c++) {
      row += grid[r][c] ? color + CELL + reset : EMPTY;
    }
    contentRows.push(row);
  }

  while (contentRows.length < 3) contentRows.push("        ");

  for (const row of contentRows) {
    lines.push(border("\u2502") + row + border("\u2502"));
  }
  lines.push(border("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"));
  return lines;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function renderGame(game: Game): string[] {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;

  // Build the board with current piece and ghost
  const display = game.board.map(r => [...r]);

  // Draw ghost piece
  if (!game.gameOver) {
    const ghost = getGhost(game);
    const ghostCells = getCells(ghost);
    for (const [r, c] of ghostCells) {
      if (r >= 0 && r < BOARD_H && c >= 0 && c < BOARD_W && display[r][c] === 0) {
        display[r][c] = -(typeIndex(game.current.type)); // negative = ghost
      }
    }
  }

  // Draw current piece
  if (!game.gameOver) {
    for (const [r, c] of getCells(game.current)) {
      if (r >= 0 && r < BOARD_H && c >= 0 && c < BOARD_W) {
        display[r][c] = typeIndex(game.current.type);
      }
    }
  }

  // Build board lines
  const boardLines: string[] = [];
  const topBot = "\u2550".repeat(BOARD_W * 2);
  boardLines.push(border("\u2554" + topBot + "\u2557"));

  for (let r = 0; r < BOARD_H; r++) {
    let row = border("\u2551");
    for (let c = 0; c < BOARD_W; c++) {
      const val = display[r][c];
      if (val > 0) row += colorCell(val);
      else if (val < 0) row += ghostCell(-val);
      else row += EMPTY;
    }
    row += border("\u2551");
    boardLines.push(row);
  }

  boardLines.push(border("\u255a" + topBot + "\u255d"));

  // Build info panel
  const nextPreview = renderMiniPiece(game.next);
  const holdPreview = renderMiniPiece(game.hold);

  const info: string[] = [];
  info.push("");
  info.push(accent(bold + " Next:" + reset));
  info.push(...nextPreview);
  info.push("");
  info.push(accent(bold + " Hold:" + reset));
  info.push(...holdPreview);
  info.push("");
  info.push(muted(" Score:  ") + accent(bold + formatNumber(game.score) + reset));
  info.push(muted(" Level:  ") + accent(bold + String(game.level) + reset));
  info.push(muted(" Lines:  ") + accent(bold + String(game.lines) + reset));
  info.push("");
  info.push(muted(" High:   ") + success(formatNumber(store.get("highScore"))));
  info.push("");
  info.push(subtle(" \u2190\u2192 Move  \u2191 Rotate"));
  info.push(subtle(" Space Hard Drop"));
  info.push(subtle(" C Hold  P Pause"));
  info.push(subtle(" Q Quit"));

  // Combine board + info side by side
  const combined: string[] = [];
  const maxLines = Math.max(boardLines.length, info.length);
  const gap = "  ";

  for (let i = 0; i < maxLines; i++) {
    const boardLine = boardLines[i] ?? "";
    const infoLine = info[i] ?? "";
    combined.push(boardLine + gap + infoLine);
  }

  // Center horizontally
  const boardWidth = BOARD_W * 2 + 2; // content + borders
  const totalWidth = boardWidth + 2 + 20; // board + gap + info
  const leftPad = Math.max(0, Math.floor((cols - totalWidth) / 2));
  const padStr = " ".repeat(leftPad);

  // Pause overlay
  if (game.paused) {
    const pauseRow = Math.floor(BOARD_H / 2);
    const pauseText = accent(bold + "  P A U S E D  " + reset);
    if (pauseRow + 1 < combined.length) {
      // Overlay on the board
      combined[pauseRow] = boardLines[pauseRow] + gap + info[pauseRow];
      combined[pauseRow + 1] = border("\u2551") + "    " + pauseText + "    " + border("\u2551") + gap + (info[pauseRow + 1] ?? "");
    }
  }

  // Build full screen
  const output: string[] = [];
  output.push(""); // top padding

  for (const line of combined) {
    output.push(padStr + line);
  }

  // Pad to fill screen
  while (output.length < rows) output.push("");

  return output;
}

function renderTitle(): string[] {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const contentWidth = Math.min(cols, 60);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);

  let bannerLines = renderBanner("TETRIS", { font: "ANSI Shadow" });
  bannerLines = centerBanner(bannerLines, contentWidth);
  bannerLines = gradientLines(bannerLines, [TH.accent, TH.error, TH.warning, TH.success]);

  const output: string[] = [];
  output.push("");
  output.push("");

  for (const bl of bannerLines) output.push(padStr + bl);

  output.push("");
  output.push(padStr + accent(bold + "          TERMINALTUI TETRIS" + reset));
  output.push("");
  output.push("");
  output.push(padStr + muted("     Press ") + accent("ENTER") + muted(" to play"));
  output.push("");
  output.push(padStr + muted("     High Score: ") + success(formatNumber(store.get("highScore"))));
  output.push("");
  output.push(padStr + border("     \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  output.push("");
  output.push(padStr + subtle("     \u2190 \u2192  Move        \u2191  Rotate"));
  output.push(padStr + subtle("     Space Hard Drop   C  Hold"));
  output.push(padStr + subtle("     P  Pause          Q  Quit"));
  output.push("");
  output.push(padStr + border("     \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  output.push("");

  while (output.length < rows) output.push("");
  return output;
}

function renderGameOver(game: Game): string[] {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const contentWidth = Math.min(cols, 50);
  const leftPad = Math.max(0, Math.floor((cols - contentWidth) / 2));
  const padStr = " ".repeat(leftPad);
  const isHighScore = game.score >= store.get("highScore") && game.score > 0;

  const output: string[] = [];
  output.push("");
  output.push("");
  output.push("");
  output.push(padStr + border("\u2554" + "\u2550".repeat(30) + "\u2557"));
  output.push(padStr + border("\u2551") + "                              " + border("\u2551"));
  output.push(padStr + border("\u2551") + error(bold + "        GAME  OVER           " + reset) + border("\u2551"));
  output.push(padStr + border("\u2551") + "                              " + border("\u2551"));
  output.push(padStr + border("\u2551") + muted("  Score: ") + accent(bold + formatNumber(game.score).padEnd(20) + reset) + border("\u2551"));
  output.push(padStr + border("\u2551") + muted("  Level: ") + accent(bold + String(game.level).padEnd(20) + reset) + border("\u2551"));
  output.push(padStr + border("\u2551") + muted("  Lines: ") + accent(bold + String(game.lines).padEnd(20) + reset) + border("\u2551"));
  output.push(padStr + border("\u2551") + "                              " + border("\u2551"));

  if (isHighScore) {
    output.push(padStr + border("\u2551") + success(bold + "   NEW HIGH SCORE!           " + reset) + border("\u2551"));
  } else {
    output.push(padStr + border("\u2551") + muted("  High:  ") + success(formatNumber(store.get("highScore")).padEnd(20)) + border("\u2551"));
  }

  output.push(padStr + border("\u2551") + "                              " + border("\u2551"));
  output.push(padStr + border("\u2551") + muted("  Press ") + accent("ENTER") + muted(" to play again  ") + border("\u2551"));
  output.push(padStr + border("\u2551") + muted("  Press ") + accent("Q") + muted("     to quit        ") + border("\u2551"));
  output.push(padStr + border("\u2551") + "                              " + border("\u2551"));
  output.push(padStr + border("\u255a" + "\u2550".repeat(30) + "\u255d"));

  while (output.length < rows) output.push("");
  return output;
}

function draw(lines: string[]): void {
  const rows = process.stdout.rows ?? 24;
  let output = "\x1b[H"; // cursor home
  for (let i = 0; i < rows; i++) {
    output += "\x1b[2K"; // clear line
    if (i < lines.length) output += lines[i];
    if (i < rows - 1) output += "\n";
  }
  process.stdout.write(output);
}

// ─── GAME LOOP ───────────────────────────────────────────

let game: Game;
let gravityTimer: ReturnType<typeof setInterval> | null = null;
let currentScreen: "title" | "playing" | "gameover" = "title";

function startGravity(): void {
  stopGravity();
  gravityTimer = setInterval(() => {
    if (game.paused || game.gameOver) return;
    if (!tryMove(game, 0, 1)) {
      // Piece landed
      lockPiece(game);
      const cleared = clearLines(game);
      if (cleared > 0) addScore(game, cleared);
      spawnNext(game);

      // Restart gravity at new speed
      if (!game.gameOver) {
        startGravity();
      } else {
        stopGravity();
      }
    }
    render();
  }, gravityMs(game.level));
}

function stopGravity(): void {
  if (gravityTimer) {
    clearInterval(gravityTimer);
    gravityTimer = null;
  }
}

function render(): void {
  switch (currentScreen) {
    case "title":
      draw(renderTitle());
      break;
    case "playing":
      draw(renderGame(game));
      break;
    case "gameover":
      draw(renderGameOver(game));
      break;
  }
}

function startGame(): void {
  game = newGame();
  currentScreen = "playing";
  render();
  startGravity();
}

function handleInput(key: string): void {
  // Global keys
  if (key === "ctrlc" || (key === "q" && currentScreen !== "playing")) {
    stopGravity();
    cleanup();
    process.exit(0);
  }

  switch (currentScreen) {
    case "title":
      if (key === "enter") startGame();
      if (key === "q") { cleanup(); process.exit(0); }
      break;

    case "playing":
      if (key === "q") {
        stopGravity();
        currentScreen = "gameover";
        game.gameOver = true;
        if (game.score > store.get("highScore")) {
          store.set("highScore", game.score);
        }
        render();
        return;
      }

      if (key === "p") {
        game.paused = !game.paused;
        render();
        return;
      }

      if (game.paused || game.gameOver) return;

      switch (key) {
        case "left": case "h":
          tryMove(game, -1, 0);
          break;
        case "right": case "l":
          tryMove(game, 1, 0);
          break;
        case "down": case "j":
          if (tryMove(game, 0, 1)) game.score += 1; // soft drop bonus
          break;
        case "up": case "k":
          tryRotate(game, 1);
          break;
        case "z":
          tryRotate(game, -1);
          break;
        case "space": {
          const dropped = hardDrop(game);
          game.score += dropped * 2; // hard drop bonus
          // Lock immediately
          lockPiece(game);
          const cleared = clearLines(game);
          if (cleared > 0) addScore(game, cleared);
          spawnNext(game);
          if (game.gameOver) {
            stopGravity();
            currentScreen = "gameover";
          } else {
            startGravity(); // reset timer
          }
          break;
        }
        case "c":
          holdPiece(game);
          break;
      }
      render();
      break;

    case "gameover":
      if (key === "enter") startGame();
      if (key === "q") { cleanup(); process.exit(0); }
      break;
  }
}

// ─── MAIN ────────────────────────────────────────────────

function main(): void {
  // Check terminal size
  const cols = process.stdout.columns ?? 80;
  if (cols < 40) {
    console.error("Terminal too narrow. Need at least 40 columns.");
    process.exit(1);
  }

  setup();

  // Handle cleanup on exit
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  process.on("uncaughtException", (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });

  // Handle resize
  process.stdout.on("resize", () => render());

  // Input
  process.stdin.on("data", (data: string) => {
    const key = parseKey(data);
    if (key) handleInput(key);
  });

  // Show title
  currentScreen = "title";
  render();
}

main();
