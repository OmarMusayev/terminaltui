/**
 * kitty's `rowcolumn-diacritics` table, vendored.
 *
 * The kitty graphics protocol's Unicode-placeholder mode addresses a cell
 * inside an image by attaching combining marks to the placeholder character:
 * the FIRST mark encodes the row, the SECOND encodes the column, both as an
 * index into this table. The table is therefore a wire-format constant — the
 * terminal decodes the index by looking the codepoint up in its own copy of
 * the same list, so a single reordered or missing entry silently shifts every
 * cell of every image.
 *
 * PROVENANCE
 *   https://raw.githubusercontent.com/kovidgoyal/kitty/master/gen/rowcolumn-diacritics.txt
 *   Retrieved 2026-07-25. sha256 of the fetched file:
 *   a80368b3272c41d8b50f3f640cf4305b6423e5a1aae6b72a405129bc29425f2c
 *   297 entries, in file order (which IS the index order — do not sort).
 *
 * kitty derives the list from UnicodeData.txt 6.0.0 with:
 *   grep "Mn;230;NSM;;" | grep -v "0300|0301|0302|0303|0304|0306|0307|0308|
 *                                   0309|030A|030B|030C|030F|0311|0313|0314|
 *                                   0342|0653|0654"
 * i.e. non-spacing marks of combining class 230 (above the base character)
 * that have no decomposition mapping, minus the ones that NFC-fuse with a
 * Latin base (`0041 0300` -> `00C0`). Fusing would destroy the index, which is
 * why the exclusion list exists and why this table cannot be regenerated from
 * a newer UnicodeData.txt without re-deriving it the same way.
 *
 * No imports: pure data, so the encoder, the width layer and tests can all
 * consume it without pulling in the runtime.
 */

/**
 * Row/column diacritic codepoints, in kitty's canonical index order.
 *
 * Index `i` in this array is the row (or column) number `i` on the wire.
 * Entry 0 is U+0305 COMBINING OVERLINE, entry 296 is U+1D244 COMBINING GREEK
 * MUSICAL PENTASEME.
 */
export const ROWCOLUMN_DIACRITICS: readonly number[] = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f, // 0..7
  0x0346, 0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357, // 8..15
  0x035b, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369, // 16..23
  0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f, 0x0483, 0x0484, // 24..31
  0x0485, 0x0486, 0x0487, 0x0592, 0x0593, 0x0594, 0x0595, 0x0597, // 32..39
  0x0598, 0x0599, 0x059c, 0x059d, 0x059e, 0x059f, 0x05a0, 0x05a1, // 40..47
  0x05a8, 0x05a9, 0x05ab, 0x05ac, 0x05af, 0x05c4, 0x0610, 0x0611, // 48..55
  0x0612, 0x0613, 0x0614, 0x0615, 0x0616, 0x0617, 0x0657, 0x0658, // 56..63
  0x0659, 0x065a, 0x065b, 0x065d, 0x065e, 0x06d6, 0x06d7, 0x06d8, // 64..71
  0x06d9, 0x06da, 0x06db, 0x06dc, 0x06df, 0x06e0, 0x06e1, 0x06e2, // 72..79
  0x06e4, 0x06e7, 0x06e8, 0x06eb, 0x06ec, 0x0730, 0x0732, 0x0733, // 80..87
  0x0735, 0x0736, 0x073a, 0x073d, 0x073f, 0x0740, 0x0741, 0x0743, // 88..95
  0x0745, 0x0747, 0x0749, 0x074a, 0x07eb, 0x07ec, 0x07ed, 0x07ee, // 96..103
  0x07ef, 0x07f0, 0x07f1, 0x07f3, 0x0816, 0x0817, 0x0818, 0x0819, // 104..111
  0x081b, 0x081c, 0x081d, 0x081e, 0x081f, 0x0820, 0x0821, 0x0822, // 112..119
  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082a, 0x082b, 0x082c, // 120..127
  0x082d, 0x0951, 0x0953, 0x0954, 0x0f82, 0x0f83, 0x0f86, 0x0f87, // 128..135
  0x135d, 0x135e, 0x135f, 0x17dd, 0x193a, 0x1a17, 0x1a75, 0x1a76, // 136..143
  0x1a77, 0x1a78, 0x1a79, 0x1a7a, 0x1a7b, 0x1a7c, 0x1b6b, 0x1b6d, // 144..151
  0x1b6e, 0x1b6f, 0x1b70, 0x1b71, 0x1b72, 0x1b73, 0x1cd0, 0x1cd1, // 152..159
  0x1cd2, 0x1cda, 0x1cdb, 0x1ce0, 0x1dc0, 0x1dc1, 0x1dc3, 0x1dc4, // 160..167
  0x1dc5, 0x1dc6, 0x1dc7, 0x1dc8, 0x1dc9, 0x1dcb, 0x1dcc, 0x1dd1, // 168..175
  0x1dd2, 0x1dd3, 0x1dd4, 0x1dd5, 0x1dd6, 0x1dd7, 0x1dd8, 0x1dd9, // 176..183
  0x1dda, 0x1ddb, 0x1ddc, 0x1ddd, 0x1dde, 0x1ddf, 0x1de0, 0x1de1, // 184..191
  0x1de2, 0x1de3, 0x1de4, 0x1de5, 0x1de6, 0x1dfe, 0x20d0, 0x20d1, // 192..199
  0x20d4, 0x20d5, 0x20d6, 0x20d7, 0x20db, 0x20dc, 0x20e1, 0x20e7, // 200..207
  0x20e9, 0x20f0, 0x2cef, 0x2cf0, 0x2cf1, 0x2de0, 0x2de1, 0x2de2, // 208..215
  0x2de3, 0x2de4, 0x2de5, 0x2de6, 0x2de7, 0x2de8, 0x2de9, 0x2dea, // 216..223
  0x2deb, 0x2dec, 0x2ded, 0x2dee, 0x2def, 0x2df0, 0x2df1, 0x2df2, // 224..231
  0x2df3, 0x2df4, 0x2df5, 0x2df6, 0x2df7, 0x2df8, 0x2df9, 0x2dfa, // 232..239
  0x2dfb, 0x2dfc, 0x2dfd, 0x2dfe, 0x2dff, 0xa66f, 0xa67c, 0xa67d, // 240..247
  0xa6f0, 0xa6f1, 0xa8e0, 0xa8e1, 0xa8e2, 0xa8e3, 0xa8e4, 0xa8e5, // 248..255
  0xa8e6, 0xa8e7, 0xa8e8, 0xa8e9, 0xa8ea, 0xa8eb, 0xa8ec, 0xa8ed, // 256..263
  0xa8ee, 0xa8ef, 0xa8f0, 0xa8f1, 0xaab0, 0xaab2, 0xaab3, 0xaab7, // 264..271
  0xaab8, 0xaabe, 0xaabf, 0xaac1, 0xfe20, 0xfe21, 0xfe22, 0xfe23, // 272..279
  0xfe24, 0xfe25, 0xfe26, 0x10a0f, 0x10a38, 0x1d185, 0x1d186, 0x1d187, // 280..287
  0x1d188, 0x1d189, 0x1d1aa, 0x1d1ab, 0x1d1ac, 0x1d1ad, 0x1d242, 0x1d243, // 288..295
  0x1d244, // 296
];

/**
 * The same table pre-rendered as single-character strings.
 *
 * Built once at module load. `encodePlacement` calls `diacriticFor` twice per
 * cell — up to ~20 000 times for a large image, every frame it is re-emitted —
 * so paying `String.fromCodePoint` per call would be pure waste.
 */
const ROWCOLUMN_DIACRITIC_CHARS: readonly string[] = ROWCOLUMN_DIACRITICS.map(cp =>
  String.fromCodePoint(cp),
);

/**
 * How many distinct rows or columns this table can address.
 *
 * DERIVED from the table, never hardcoded: kitty has grown this list before
 * (it must stay >= 256 for the 8-bit id case, and today it is 297), and a
 * stale constant here would either refuse legal images or emit an index the
 * terminal cannot decode. Callers must clamp or refuse an image wider or
 * taller than this BEFORE encoding — see `encodePlacement`, which throws.
 */
export const MAX_PLACEHOLDER_CELLS = ROWCOLUMN_DIACRITICS.length;

/**
 * The combining mark encoding row/column index `index`.
 *
 * Throws `RangeError` rather than clamping: a clamped index silently maps two
 * different image rows onto the same terminal row, which renders as a plausible
 * but wrong picture. Callers gate on `MAX_PLACEHOLDER_CELLS` first, so reaching
 * the throw means a bug upstream, not bad user input.
 */
export function diacriticFor(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PLACEHOLDER_CELLS) {
    throw new RangeError(
      `kitty placeholder index ${index} out of range 0..${MAX_PLACEHOLDER_CELLS - 1}`,
    );
  }
  return ROWCOLUMN_DIACRITIC_CHARS[index]!;
}

// Reverse lookup, built lazily because only the decoder side (tests, the
// emulator) ever needs it — the render path is write-only.
let reverseIndex: Map<number, number> | null = null;

/**
 * Index of a codepoint in the row/column table, or `-1` if it is not in it.
 *
 * Exists so a decoder can round-trip `encodePlacement` output back to (row,
 * column) pairs, which is how the encoder is verified without a kitty window.
 */
export function diacriticIndexOf(codepoint: number): number {
  if (reverseIndex === null) {
    reverseIndex = new Map();
    for (let i = 0; i < ROWCOLUMN_DIACRITICS.length; i++) {
      reverseIndex.set(ROWCOLUMN_DIACRITICS[i]!, i);
    }
  }
  return reverseIndex.get(codepoint) ?? -1;
}

/**
 * True when `code` is one of the row/column diacritics.
 *
 * Every entry is a non-spacing mark and MUST measure zero display columns, or a
 * placeholder row inflates by one cell per diacritic and breaks centring, the
 * focus gutter and the truncation guard. `charWidth` in components/base.ts does
 * not cover the whole set on its own (report §3.2: 18 of the first 48 entries
 * measure 1), so this predicate is the authoritative membership test.
 */
export function isRowColumnDiacritic(code: number): boolean {
  return diacriticIndexOf(code) >= 0;
}
