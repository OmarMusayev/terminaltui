import type { Font } from "./types.js";

export const fontData: Font = {
  name: "Block",
  height: 4,
  chars: {
    A: [
      "▄█▄ ",
      "█ █ ",
      "███ ",
      "█ █ ",
    ],
    B: [
      "██▄ ",
      "█▄█ ",
      "█ █ ",
      "██▀ ",
    ],
    C: [
      "▄██ ",
      "█   ",
      "█   ",
      "▀██ ",
    ],
    D: [
      "██▄ ",
      "█ █ ",
      "█ █ ",
      "██▀ ",
    ],
    E: [
      "███ ",
      "█▄  ",
      "█▀  ",
      "███ ",
    ],
    F: [
      "███ ",
      "█▄  ",
      "█   ",
      "█   ",
    ],
    G: [
      "▄██ ",
      "█   ",
      "█▄█ ",
      "▀██ ",
    ],
    H: [
      "█ █ ",
      "███ ",
      "█ █ ",
      "█ █ ",
    ],
    I: [
      "███ ",
      " █  ",
      " █  ",
      "███ ",
    ],
    J: [
      " ██ ",
      "  █ ",
      "█ █ ",
      "▀█▀ ",
    ],
    K: [
      "█▄█ ",
      "██  ",
      "█▀█ ",
      "█ █ ",
    ],
    L: [
      "█   ",
      "█   ",
      "█   ",
      "███ ",
    ],
    // M, V and W each carry an interior diagonal, and each used to draw it as a
    // horizontal BAR between two full-height stems — which is the letter H, or a
    // letter U, depending on how high the bar sat:
    //
    //     M "█▄▄█ / █▀▀█ / █  █ / █  █"   V "█  █ / █  █ / ▀▄▄▀ / ▀▀"
    //     H "█ █ / ███ / █ █ / █ █"       U "█ █ / █ █ / █ █ / ▀█▀"
    //
    // Captured on a real terminal, "TRY: TERMINALTUI.DEV" read as
    // "TRY: TERHINALTUI.DEU" and "WATCHING" read as "HATCHING". The three are
    // redrawn below so the diagonal is a SEQUENCE of offset half-blocks rather
    // than one flat rule: the stroke now changes column as it changes row, which
    // is the only cue at this resolution that separates them from H and U.
    //
    // Each grew a column (5 -> 6 including the inter-letter space): centring a
    // middle stem needs an odd ink width, and 3 ink columns cannot hold two
    // stems plus a gap.
    M: [
      "█▄ ▄█ ",
      "█▀▄▀█ ",
      "█   █ ",
      "█   █ ",
    ],
    N: [
      "█▄ █ ",
      "█▀██ ",
      "█ ▀█ ",
      "█  █ ",
    ],
    O: [
      "▄█▄ ",
      "█ █ ",
      "█ █ ",
      "▀█▀ ",
    ],
    P: [
      "██▄ ",
      "█ █ ",
      "██▀ ",
      "█   ",
    ],
    Q: [
      "▄█▄ ",
      "█ █ ",
      "█▄█ ",
      "▀ ▀█",
    ],
    R: [
      "██▄ ",
      "█ █ ",
      "██▀ ",
      "█ █ ",
    ],
    S: [
      "▄██ ",
      "█▄  ",
      " ▀█ ",
      "██▀ ",
    ],
    T: [
      "████ ",
      " ██  ",
      " ██  ",
      " ██  ",
    ],
    U: [
      "█ █ ",
      "█ █ ",
      "█ █ ",
      "▀█▀ ",
    ],
    // Strokes that actually CONVERGE, drawn on half-columns.
    //
    // Every earlier attempt at this letter failed the same way, and it took
    // three goes to name the reason: a V needs its strokes to move inward as
    // they descend, and a whole-cell grid cannot move them by less than a whole
    // cell. `█ █` over ` █ ` steps a full column in one row, which puts the rows
    // corner-to-corner — a terminal draws a corner touch as a detached speck,
    // not a join. Avoiding the speck by keeping the stems parallel and closing
    // them with `█▄█` connects fine but is no longer a V at all: rendered large
    // it reads as a U with a stub under it, which is exactly what it is.
    //
    // ▌ and ▐ break the grid. They give HALF-column resolution, so a stroke one
    // full cell wide can step inward half a cell per row, and consecutive rows
    // then overlap by half a cell — a shared vertical edge, not a corner. The
    // gap between the strokes closes 6 half-columns → 4 → 2 → 0 down the four
    // rows, and where they meet on row 3 the left stroke's ▌ and the right
    // stroke's ▐ land in the same cell and fuse into `█`.
    //
    // Five columns, because convergence needs somewhere to travel: at the
    // face's usual four there is not enough width for the taper to be visible.
    // This is the one letter in the face allowed the extra column.
    V: [
      "█   █ ",
      "▐▌ ▐▌ ",
      " ▐█▌  ",
      "  ▀   ",
    ],
    // Literally two of the `V` above, overlapped so they share their middle
    // column: the left V occupies columns 0–4, the right V columns 4–8, and on
    // row 2 the left V's ▌ and the right V's ▐ meet in column 4 and fuse into
    // the `█` that is the letter's centre peak. Same half-column construction,
    // same reason — a W is where the old whole-cell form failed worst, because
    // it stacked the fault twice and put TWO specks under the letter.
    W: [
      "█   █   █ ",
      "▐▌ ▐█▌ ▐▌ ",
      " ▐█▌ ▐█▌  ",
      "  ▀   ▀   ",
    ],
    X: [
      "█ █ ",
      "▀█▀ ",
      "▄█▄ ",
      "█ █ ",
    ],
    Y: [
      "█ █ ",
      "▀█▀ ",
      " █  ",
      " █  ",
    ],
    Z: [
      "███ ",
      " ▄█ ",
      "█▀  ",
      "███ ",
    ],
    "0": ["▄█▄ ", "█ █ ", "█ █ ", "▀█▀ "],
    "1": [" █  ", "██  ", " █  ", "███ "],
    "2": ["▄█▄ ", " ▄█ ", "█▀  ", "███ "],
    "3": ["██▄ ", " ▄█ ", " ▀█ ", "██▀ "],
    "4": ["█ █ ", "███ ", "  █ ", "  █ "],
    "5": ["███ ", "█▄  ", " ▀█ ", "██▀ "],
    "6": ["▄██ ", "█▄  ", "█ █ ", "▀█▀ "],
    "7": ["███ ", "  █ ", " █  ", "█   "],
    "8": ["▄█▄ ", "▀█▀ ", "▄█▄ ", "▀█▀ "],
    "9": ["▄█▄ ", "█ █ ", "▀██ ", " ▄█ "],
    " ": ["   ", "   ", "   ", "   "],
    ".": ["  ", "  ", "  ", "▀ "],
    "!": ["█ ", "█ ", "  ", "▀ "],
    "-": ["    ", "▄▄▄ ", "    ", "    "],
    ":": ["  ", "▀ ", "  ", "▀ "],
    "_": ["    ", "    ", "    ", "▄▄▄ "],
  },
};
