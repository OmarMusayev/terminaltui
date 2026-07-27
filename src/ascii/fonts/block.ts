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
    // Four columns like every other letter, stems at FULL height for three of
    // the four rows, and the point ATTACHED.
    //
    // Two defects were in play. The letter used to be six columns wide with its
    // stems two apart, so the converging rows could only meet diagonally:
    // ` █ █ ` over `  ▀  ` puts the vertex corner-to-corner with the strokes
    // above it, and a terminal draws a corner touch as a detached speck rather
    // than a join. Pinching at `▀█▀` fixed the join but bought it by cutting the
    // stems off after two rows — half-height ▀ cells on row 3 — which left V
    // visibly squat next to the full-height letters either side of it.
    //
    // Joining at the BOTTOM of row 3 instead (`█▄█`) does both: the ▄ shares a
    // vertical edge with the full blocks on each side, so it is a real join, and
    // the stems stay full height the whole way down to it. The ▀ on row 4 then
    // sits directly under that ▄ in the same column — again a vertical edge, not
    // a corner — so the taper reads as one continuous descent to a point.
    V: [
      "█ █ ",
      "█ █ ",
      "█▄█ ",
      " ▀  ",
    ],
    // Two V's sharing a centre stem, so it takes the same fix as `V` — the ▄
    // cells on row 3 are what attach the two points to the letter. Row 3 was
    // `█ █ █`, three stems with nothing between them, leaving the ` ▀ ▀ ` below
    // touching only at corners: two specks under a letter rather than the feet
    // of one. Six columns is kept here (V's six were the anomaly, W earns them);
    // the interior stroke still changes column as it changes row, which is what
    // keeps W from reading as H at four rows.
    W: [
      "█   █ ",
      "█   █ ",
      "█▄█▄█ ",
      " ▀ ▀  ",
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
