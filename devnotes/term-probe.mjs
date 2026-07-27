#!/usr/bin/env node
/**
 * term-probe.mjs — terminal image/graphics capability probe
 *
 * Zero dependencies. Node 18+. ESM.
 *
 *   node term-probe.mjs                 # full probe
 *   node term-probe.mjs --timeout=800   # slower terminal / over SSH
 *   node term-probe.mjs --no-query      # env + swatches only, never touches raw mode
 *   node term-probe.mjs --no-visual     # env + queries only, no escape-heavy swatches
 *   node term-probe.mjs --tmux          # ALSO emit tmux-passthrough-wrapped graphics
 *   node term-probe.mjs --help
 *
 * Safety: the active-query phase puts stdin in raw mode, writes all queries at once,
 * and stops on EITHER a Primary-DA reply (sentinel) OR a hard timeout. Raw mode is
 * restored on every exit path (normal, timeout, throw, SIGINT, SIGTERM, process exit).
 */

import { deflateSync } from 'node:zlib';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const num = (f, d) => {
  const a = ARGV.find((x) => x.startsWith(f + '='));
  return a ? Number(a.slice(f.length + 1)) || d : d;
};

if (has('--help') || has('-h')) {
  process.stdout.write(
    [
      'term-probe.mjs — what can this terminal actually draw?',
      '',
      '  --timeout=MS   active-query hard timeout (default 400)',
      '  --grace=MS     extra wait after the Primary-DA sentinel (default 120)',
      '  --no-query     skip the active raw-mode query phase entirely',
      '  --no-visual    skip the visual swatches',
      '  --tmux         additionally emit tmux passthrough-wrapped graphics',
      '  --help         this text',
      '',
      'Run it, then tell me which numbered swatches actually rendered as images',
      'and which showed up as garbage text / nothing.',
      '',
    ].join('\n')
  );
  process.exit(0);
}

// --self-test parses canned real-world replies so the classifier can be
// verified without a live terminal. Function declarations below are hoisted.
if (has('--self-test')) {
  const CORPUS = {
    'kitty 0.42':
      '\x1bP>|kitty(0.42.2)\x1b\\\x1b[>1;4000;36c\x1b_Gi=31;OK\x1b\\\x1b[?0u' +
      '\x1b[?2026;2$y\x1b[6;22;11t\x1b[4;1408;1782t\x1b]11;rgb:1c1c/1c1c/1c1c\x1b\\\x1b[?62;c',
    'xterm +sixel':
      '\x1b[>41;388;0c\x1b[?1;0;256S\x1b[?2;0;1000;1000S\x1b[6;13;6t\x1b[4;338;486t' +
      '\x1b]11;rgb:0000/0000/0000\x1b\\\x1b[?63;1;2;4;6;9;15;22c',
    'iTerm2 3.5':
      '\x1bP>|iTerm2 3.5.0\x1b\\\x1b[>0;95;0c\x1b[6;34;16t\x1b[?62;4c',
    'Apple Terminal':
      '\x1b[>1;95;0c\x1b]11;rgb:ffff/ffff/ffff\x1b\\\x1b[?1;2c',
    'ghostty 1.1':
      '\x1bP>|ghostty 1.1.3\x1b\\\x1b_Gi=31;OK\x1b\\\x1b[?0u\x1b[?2026;2$y\x1b[?62;22c',
    'wezterm':
      '\x1bP>|WezTerm 20240203-110809-5046fc22\x1b\\\x1b_Gi=31;OK\x1b\\\x1b[?65;4;6;18;22c',
    'empty (nobody home)': '',
    'junk only': '\x04\x00\x1b',
  };
  for (const [name, stream] of Object.entries(CORPUS)) {
    process.stdout.write('\n=== ' + name + ' ===\n');
    const parts = splitReplies(stream);
    if (!parts.length) { process.stdout.write('  (no replies)\n'); continue; }
    for (const p of parts) {
      const c = classify(p);
      process.stdout.write('  ' + c.label.padEnd(30) + (c.note || '') + '\n');
      process.stdout.write('      ' + escBytes(Buffer.from(p, 'latin1')) + '\n');
    }
  }
  process.stdout.write('\n');
  process.exit(0);
}

const TIMEOUT = num('--timeout', 400);
const GRACE = num('--grace', 120);
const DO_QUERY = !has('--no-query');
const DO_VISUAL = !has('--no-visual');
const FORCE_TMUX = has('--tmux');

const out = (s) => process.stdout.write(s);
const line = (s = '') => out(s + '\n');

// ---------------------------------------------------------------------------
// pretty printing
// ---------------------------------------------------------------------------
const C = process.stdout.isTTY
  ? { h: '\x1b[1;36m', k: '\x1b[33m', v: '\x1b[32m', d: '\x1b[90m', b: '\x1b[1m', r: '\x1b[0m' }
  : { h: '', k: '', v: '', d: '', b: '', r: '' };

function header(t) {
  line();
  line(C.h + '━'.repeat(72) + C.r);
  line(C.h + '  ' + t + C.r);
  line(C.h + '━'.repeat(72) + C.r);
}
function kv(k, v, note = '') {
  const key = String(k).padEnd(24);
  line('  ' + C.k + key + C.r + (v === undefined || v === '' ? C.d + '(unset)' + C.r : C.v + v + C.r) + (note ? '  ' + C.d + note + C.r : ''));
}

/** Byte buffer -> readable text: ESC/BEL/ST named, printable kept, rest hex. */
function escBytes(buf) {
  let s = '';
  for (const b of buf) {
    if (b === 0x1b) s += '<ESC>';
    else if (b === 0x07) s += '<BEL>';
    else if (b === 0x9c) s += '<ST8>';
    else if (b === 0x0a) s += '<LF>';
    else if (b === 0x0d) s += '<CR>';
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += '<' + b.toString(16).padStart(2, '0') + '>';
  }
  return s;
}
function hexDump(buf, per = 24) {
  const lines = [];
  for (let i = 0; i < buf.length; i += per) {
    const slice = buf.subarray(i, i + per);
    lines.push(
      '    ' +
        String(i).padStart(4, '0') +
        '  ' +
        [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 1. ENVIRONMENT
// ---------------------------------------------------------------------------
const E = process.env;

const KNOWN_VARS = [
  // generic
  'TERM', 'COLORTERM', 'TERMINFO', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION',
  'NO_COLOR', 'CLICOLOR', 'CLICOLOR_FORCE', 'FORCE_COLOR',
  // kitty
  'KITTY_WINDOW_ID', 'KITTY_PID', 'KITTY_INSTALLATION_DIR', 'KITTY_LISTEN_ON',
  // ghostty
  'GHOSTTY_RESOURCES_DIR', 'GHOSTTY_BIN_DIR', 'GHOSTTY_SHELL_INTEGRATION_NO_SUDO',
  // iterm2
  'ITERM_SESSION_ID', 'ITERM_PROFILE', 'LC_TERMINAL', 'LC_TERMINAL_VERSION',
  // wezterm
  'WEZTERM_PANE', 'WEZTERM_EXECUTABLE', 'WEZTERM_CONFIG_FILE', 'WEZTERM_UNIX_SOCKET',
  'WEZTERM_EXECUTABLE_DIR', 'WEZTERM_VERSION',
  // windows terminal / conpty
  'WT_SESSION', 'WT_PROFILE_ID', 'ConEmuANSI', 'ANSICON',
  // kde / gnome / vte family
  'KONSOLE_VERSION', 'KONSOLE_DBUS_SESSION', 'KONSOLE_PROFILE_NAME',
  'VTE_VERSION', 'GNOME_TERMINAL_SCREEN', 'GNOME_TERMINAL_SERVICE',
  // others
  'ALACRITTY_WINDOW_ID', 'ALACRITTY_SOCKET', 'ALACRITTY_LOG',
  'CONTOUR_PROFILE', 'FOOT_VERSION', 'RIO_TERMINAL', 'WARP_HONOR_PS1',
  'MINTTY_SHORTCUT', 'MSYSTEM', 'TABBY_CONFIG_DIRECTORY', 'HYPER_VERSION',
  'VSCODE_INJECTION', 'VSCODE_GIT_ASKPASS_MAIN', 'JEDITERM_SOURCE',
  'TERMINAL_EMULATOR', 'TERMUX_VERSION', 'ZED_TERM', 'INSIDE_EMACS',
  // multiplexers / remote
  'TMUX', 'TMUX_PANE', 'STY', 'WINDOW', 'ZELLIJ', 'ZELLIJ_SESSION_NAME',
  'SSH_TTY', 'SSH_CLIENT', 'SSH_CONNECTION', 'DISPLAY', 'WAYLAND_DISPLAY',
  // locale (unicode detection)
  'LANG', 'LC_ALL', 'LC_CTYPE',
];

header('1. ENVIRONMENT');
const seen = new Set();
for (const k of KNOWN_VARS) {
  seen.add(k);
  if (E[k] !== undefined) kv(k, E[k]);
}
line();
line('  ' + C.d + 'set-but-unlisted terminal-ish vars:' + C.r);
const extra = Object.keys(E)
  .filter((k) => !seen.has(k))
  .filter((k) => /TERM|KITTY|ITERM|WEZ|GHOSTTY|KONSOLE|VTE|ALACRITTY|FOOT|CONTOUR|MINTTY|SIXEL|GRAPH|WARP|RIO|TABBY|HYPER|MULTIPLEX/i.test(k))
  .sort();
if (extra.length === 0) line('    ' + C.d + '(none)' + C.r);
for (const k of extra) kv('  ' + k, E[k]);

line();
line('  ' + C.d + 'unlisted vars we did NOT find (absence is also a signal):' + C.r);
const notable = ['TERM_PROGRAM', 'COLORTERM', 'KITTY_WINDOW_ID', 'ITERM_SESSION_ID', 'WT_SESSION', 'TMUX'];
const missing = notable.filter((k) => E[k] === undefined);
line('    ' + (missing.length ? missing.map((k) => C.d + k + C.r).join(' ') : C.d + '(all present)' + C.r));

// ---------------------------------------------------------------------------
// 2. TTY / SIZE
// ---------------------------------------------------------------------------
header('2. TTY & SIZE');
const stdoutTTY = !!process.stdout.isTTY;
const stdinTTY = !!process.stdin.isTTY;
const stderrTTY = !!process.stderr.isTTY;
kv('process.stdout.isTTY', String(stdoutTTY));
kv('process.stdin.isTTY', String(stdinTTY));
kv('process.stderr.isTTY', String(stderrTTY));
kv('columns', String(process.stdout.columns ?? '(undefined)'), stdoutTTY ? '' : 'not a TTY -> assume 80');
kv('rows', String(process.stdout.rows ?? '(undefined)'), stdoutTTY ? '' : 'not a TTY -> assume 24');
kv('platform', process.platform);
kv('node', process.version);

// a write handle to the real tty even if stdout is piped (best effort)
let ttyFd = null;
if (!stdoutTTY) {
  try {
    ttyFd = fs.openSync('/dev/tty', 'r+');
    kv('/dev/tty fallback', 'opened (fd ' + ttyFd + ')', 'queries can still be sent');
  } catch {
    kv('/dev/tty fallback', 'unavailable');
  }
}

const unicodeLikely =
  /UTF-?8/i.test(E.LC_ALL || E.LC_CTYPE || E.LANG || '') ||
  process.platform === 'darwin' ||
  process.platform === 'win32' ||
  !!(E.KITTY_WINDOW_ID || E.WT_SESSION || E.WEZTERM_PANE || E.GHOSTTY_RESOURCES_DIR || E.ITERM_SESSION_ID);
kv('unicode likely', String(unicodeLikely), 'from locale + terminal id');

// ---------------------------------------------------------------------------
// 3. ACTIVE QUERIES
// ---------------------------------------------------------------------------
const QUERIES = [
  { id: 'xtversion', name: 'XTVERSION', bytes: '\x1b[>0q', expect: 'DCS >|<name> ST' },
  { id: 'da2', name: 'Secondary DA', bytes: '\x1b[>c', expect: 'CSI > Pp;Pv;Pc c' },
  { id: 'tcap', name: 'XTGETTCAP TN', bytes: '\x1bP+q544E\x1b\\', expect: 'DCS 1+r544E=<hex> ST' },
  { id: 'kitty', name: 'Kitty graphics', bytes: '\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\', expect: 'APC G i=31;OK ST' },
  { id: 'kbd', name: 'Kitty keyboard proto', bytes: '\x1b[?u', expect: 'CSI ? <flags> u' },
  { id: 'sync', name: 'DECRQM 2026 (sync)', bytes: '\x1b[?2026$p', expect: 'CSI ? 2026 ; Pm $ y' },
  { id: 'gr_regs', name: 'XTSMGRAPHICS color regs', bytes: '\x1b[?1;1S', expect: 'CSI ? 1;0;<n> S' },
  { id: 'gr_geom', name: 'XTSMGRAPHICS sixel geom', bytes: '\x1b[?2;1S', expect: 'CSI ? 2;0;<w>;<h> S' },
  { id: 'cell', name: 'Cell size in px', bytes: '\x1b[16t', expect: 'CSI 6;<h>;<w> t' },
  { id: 'winpx', name: 'Window size in px', bytes: '\x1b[14t', expect: 'CSI 4;<h>;<w> t' },
  { id: 'bg', name: 'Background color', bytes: '\x1b]11;?\x1b\\', expect: 'OSC 11;rgb:r/g/b ST' },
  { id: 'da1', name: 'Primary DA (SENTINEL)', bytes: '\x1b[c', expect: 'CSI ? Ps;Ps;... c' },
];

/** Send every query, read replies, never hang. */
function runQueries(timeoutMs, graceMs) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const canRaw = stdinTTY && typeof stdin.setRawMode === 'function';
    const writeFd = stdoutTTY ? null : ttyFd;
    if (!canRaw) {
      return resolve({
        skipped: true,
        reason: stdinTTY
          ? 'stdin.setRawMode unavailable'
          : 'stdin is not a TTY (piped/redirected) — terminals only answer an interactive tty',
        raw: Buffer.alloc(0),
      });
    }
    if (!stdoutTTY && writeFd === null) {
      return resolve({
        skipped: true,
        reason: 'stdout is not a TTY and /dev/tty could not be opened — nowhere to send queries',
        raw: Buffer.alloc(0),
      });
    }

    const chunks = [];
    let done = false;
    let hardTimer = null;
    let graceTimer = null;

    const restore = () => {
      try { stdin.setRawMode(false); } catch {}
      try { stdin.removeListener('data', onData); } catch {}
      try { stdin.pause(); } catch {}
    };
    // belt-and-braces: restore on any exit path
    const onExit = () => restore();
    const onSigInt = () => { restore(); process.exit(130); };
    const onSigTerm = () => { restore(); process.exit(143); };
    process.once('exit', onExit);
    process.once('SIGINT', onSigInt);
    process.once('SIGTERM', onSigTerm);

    const finish = (how) => {
      if (done) return;
      done = true;
      if (hardTimer) clearTimeout(hardTimer);
      if (graceTimer) clearTimeout(graceTimer);
      restore();
      process.removeListener('exit', onExit);
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);
      // any query the terminal did NOT understand may have echoed junk onto
      // the current line — wipe it so the report stays readable
      try {
        if (writeFd !== null) fs.writeSync(writeFd, '\r\x1b[2K');
        else if (stdoutTTY) process.stdout.write('\r\x1b[2K');
      } catch {}
      resolve({ skipped: false, how, raw: Buffer.concat(chunks) });
    };

    function onData(buf) {
      chunks.push(buf);
      const s = Buffer.concat(chunks).toString('latin1');
      // Primary-DA reply is CSI ? ... c  (secondary DA is CSI > ... c — different)
      if (/\x1b\[\?[0-9;]*c/.test(s) && graceTimer === null) {
        graceTimer = setTimeout(() => finish('sentinel+grace'), graceMs);
      }
      // Ctrl-C while in raw mode must still work
      if (buf.includes(0x03)) finish('interrupted');
    }

    try {
      stdin.setRawMode(true);
    } catch (e) {
      return resolve({ skipped: true, reason: 'setRawMode threw: ' + e.message, raw: Buffer.alloc(0) });
    }
    stdin.resume();
    stdin.on('data', onData);
    hardTimer = setTimeout(() => finish('timeout'), timeoutMs);

    const payload = QUERIES.map((q) => q.bytes).join('');
    try {
      if (writeFd !== null) fs.writeSync(writeFd, payload);
      else process.stdout.write(payload);
    } catch (e) {
      finish('write-failed:' + e.message);
    }
  });
}

/**
 * Split a reply stream into individual escape sequences.
 * Splitting naively on ESC would tear the ST terminator (ESC \) off the end of
 * every DCS/OSC/APC reply and report it as a bogus extra "unrecognised" reply,
 * so a leading bare ST is re-attached to the sequence it closes.
 */
function splitReplies(str) {
  const parts = str.split(/(?=\x1b)/).filter((s) => s.length);
  const merged = [];
  for (const p of parts) {
    if (p.startsWith('\x1b\\') && merged.length) {
      merged[merged.length - 1] += '\x1b\\';
      const rest = p.slice(2);
      if (rest.length) merged.push(rest);
    } else {
      merged.push(p);
    }
  }
  return merged;
}

function classify(seq) {
  let m;
  if ((m = /^\x1b\[\?([0-9;]*)c/.exec(seq))) {
    const ps = m[1].split(';');
    return { id: 'da1', label: 'Primary DA', params: ps, note: 'attrs: ' + ps.join(',') + (ps.includes('4') ? '  ** ";4" PRESENT -> SIXEL **' : '  (no ";4" -> no sixel)') };
  }
  if ((m = /^\x1b\[>([0-9;]*)c/.exec(seq))) {
    const ps = m[1].split(';');
    const FAMILY = { '0': 'VT100', '1': 'VT220', '2': 'VT240/241', '18': 'VT330', '19': 'VT340', '24': 'VT320', '32': 'VT382', '41': 'VT420', '61': 'VT510', '64': 'VT520', '65': 'VT525' };
    return { id: 'da2', label: 'Secondary DA', params: ps, note: 'type=' + (FAMILY[ps[0]] || ps[0]) + ' version=' + (ps[1] ?? '?') + ' (xterm reports patchlevel here)' };
  }
  if ((m = /^\x1bP>\|([^\x1b\x07]*)/.exec(seq))) {
    return { id: 'xtversion', label: 'XTVERSION', note: 'terminal self-reports: "' + m[1] + '"' };
  }
  if ((m = /^\x1bP([01])\+r([0-9A-Fa-f]*)=?([0-9A-Fa-f]*)/.exec(seq))) {
    const okc = m[1] === '1';
    let decoded = '';
    try { decoded = Buffer.from(m[3], 'hex').toString('latin1'); } catch {}
    return { id: 'tcap', label: 'XTGETTCAP', note: (okc ? 'ok' : 'FAILED') + (decoded ? '  TN="' + decoded + '"' : '') };
  }
  if ((m = /^\x1b_G([^\x1b\x07]*)/.exec(seq))) {
    const ok = /;OK/.test(m[1]);
    return { id: 'kitty', label: 'Kitty graphics', note: ok ? '** OK -> KITTY GRAPHICS PROTOCOL SUPPORTED **' : 'replied but not OK: ' + m[1] };
  }
  if ((m = /^\x1b\[\?([0-9]+)u/.exec(seq))) {
    return { id: 'kbd', label: 'Kitty keyboard proto', note: 'flags=' + m[1] + ' (kitty/ghostty/wezterm/foot/rio family)' };
  }
  if ((m = /^\x1b\[\?2026;([0-9]+)\$y/.exec(seq))) {
    const V = { '0': 'not recognised', '1': 'set', '2': 'reset (supported)', '3': 'perm set', '4': 'perm reset' };
    return { id: 'sync', label: 'Synchronized output (2026)', note: V[m[1]] + ' -> ' + (m[1] === '0' ? 'NOT supported' : 'SUPPORTED (flicker-free frames)') };
  }
  if ((m = /^\x1b\[\?([12]);([0-9]+)(?:;([0-9;]+))?S/.exec(seq))) {
    const which = m[1] === '1' ? 'color registers' : 'sixel geometry';
    return { id: 'gr' + m[1], label: 'XTSMGRAPHICS ' + which, note: m[2] === '0' ? 'value=' + (m[3] ?? '?') : 'error status ' + m[2] };
  }
  if ((m = /^\x1b\[6;([0-9]+);([0-9]+)t/.exec(seq))) {
    return { id: 'cell', label: 'Cell size', note: m[2] + ' x ' + m[1] + ' px per cell', cellW: +m[2], cellH: +m[1] };
  }
  if ((m = /^\x1b\[4;([0-9]+);([0-9]+)t/.exec(seq))) {
    return { id: 'winpx', label: 'Window size', note: m[2] + ' x ' + m[1] + ' px', winW: +m[2], winH: +m[1] };
  }
  if ((m = /^\x1b\]11;([^\x1b\x07]*)/.exec(seq))) {
    return { id: 'bg', label: 'Background color', note: m[1] };
  }
  if ((m = /^\x1b\[([0-9;]*)R/.exec(seq))) {
    return { id: 'cpr', label: 'Cursor position report', note: m[1] };
  }
  return { id: 'unknown', label: 'unrecognised', note: '' };
}

// ---------------------------------------------------------------------------
// 4. VISUAL SWATCHES — support code
// ---------------------------------------------------------------------------
function rgbTo256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const q = (v) => Math.round((v / 255) * 5);
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
}
const fg24 =(r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const bg24 = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const fg256 = (r, g, b) => `\x1b[38;5;${rgbTo256(r, g, b)}m`;
const bg256 = (r, g, b) => `\x1b[48;5;${rgbTo256(r, g, b)}m`;
const RST = '\x1b[0m';

function hsv(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** the little test image everything renders: 16x16 RGB */
function testImage(w = 16, h = 16) {
  const px = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = (x - w / 2 + 0.5) / (w / 2), cy = (y - h / 2 + 0.5) / (h / 2);
      const d = Math.sqrt(cx * cx + cy * cy);
      const ang = (Math.atan2(cy, cx) / (Math.PI * 2) + 1) % 1;
      const [r, g, b] = d < 0.95 ? hsv(ang, 1, Math.max(0.15, 1 - d * 0.6)) : [24, 24, 32];
      px.push([r, g, b]);
    }
  }
  return { w, h, px, at: (x, y) => px[y * w + x] };
}

// ---- real PNG encoder (zero deps, uses node:zlib) --------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** rgb: Buffer of w*h*3 */
function encodePNG(w, h, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor RGB
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function imageToRGBBuffer(img, scale = 1) {
  const W = img.w * scale, H = img.h * scale;
  const b = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, bl] = img.at(Math.floor(x / scale), Math.floor(y / scale));
      const o = (y * W + x) * 3;
      b[o] = r; b[o + 1] = g; b[o + 2] = bl;
    }
  }
  return { W, H, buf: b };
}

/** tmux DCS passthrough: ESC must be doubled inside. */
function tmuxWrap(s) {
  return '\x1bPtmux;' + s.replace(/\x1b/g, '\x1b\x1b') + '\x1b\\';
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const detected = {}; // filled by query phase

async function main() {
  header('3. ACTIVE QUERIES');

  if (!DO_QUERY) {
    line('  ' + C.d + 'skipped (--no-query)' + C.r);
  } else {
    line('  ' + C.d + `sending ${QUERIES.length} queries; hard timeout ${TIMEOUT}ms, sentinel grace ${GRACE}ms` + C.r);
    for (const q of QUERIES) {
      line('    ' + C.k + q.name.padEnd(26) + C.r + C.d + escBytes(Buffer.from(q.bytes, 'latin1')) + C.r);
    }
    line();

    const res = await runQueries(TIMEOUT, GRACE);

    if (res.skipped) {
      line('  ' + C.b + 'QUERY PHASE SKIPPED' + C.r + ' — ' + res.reason);
      line('  ' + C.d + 'This is EXPECTED when output is piped/redirected or run by a tool.' + C.r);
      line('  ' + C.d + 'Re-run directly in an interactive terminal to get real answers.' + C.r);
    } else if (res.raw.length === 0) {
      line('  ' + C.b + 'NO BYTES RECEIVED' + C.r + ' (ended via: ' + res.how + ')');
      line('  ' + C.d + 'Terminal answered nothing at all. Either it is extremely minimal,' + C.r);
      line('  ' + C.d + 'something upstream is swallowing replies (tmux/screen/ssh), or the' + C.r);
      line('  ' + C.d + 'timeout is too short — retry with --timeout=1500.' + C.r);
    } else {
      line('  ended via: ' + C.v + res.how + C.r + '   bytes received: ' + C.v + res.raw.length + C.r);
      line();
      line('  ' + C.b + 'RAW (escaped):' + C.r);
      line('    ' + escBytes(res.raw));
      line();
      line('  ' + C.b + 'RAW (hex):' + C.r);
      line(hexDump(res.raw));
      line();
      line('  ' + C.b + 'INTERPRETATION:' + C.r);
      const replies = splitReplies(res.raw.toString('latin1'));
      let recognized = 0;
      for (const r of replies) {
        const c = classify(r);
        if (c.id !== 'unknown') recognized++;
        line('    ' + C.k + c.label.padEnd(30) + C.r + C.v + (c.note || '') + C.r);
        line('      ' + C.d + escBytes(Buffer.from(r, 'latin1')) + C.r);
        if (c.id === 'da1') { detected.sawDA1 = true; detected.sixelDA = c.params.includes('4'); }
        if (c.id === 'kitty') detected.kitty = /SUPPORTED/.test(c.note);
        if (c.id === 'xtversion') detected.xtversion = c.note;
        if (c.id === 'cell') { detected.cellW = c.cellW; detected.cellH = c.cellH; }
        if (c.id === 'winpx') { detected.winW = c.winW; detected.winH = c.winH; }
        if (c.id === 'sync') detected.sync = /SUPPORTED/.test(c.note);
        if (c.id === 'kbd') detected.kittyKbd = true;
        if (c.id === 'gr2') detected.sixelGeom = c.note;
        if (c.id === 'bg') detected.bg = c.note;
      }
      // things that answered nothing
      const gotIds = new Set(replies.map((r) => classify(r).id));
      const silent = QUERIES.filter((q) => !gotIds.has(q.id)).map((q) => q.name);
      if (silent.length) {
        line();
        line('    ' + C.d + 'no reply to: ' + silent.join(', ') + C.r);
      }
      // "answered" ONLY if the Primary-DA sentinel came back. Without it we
      // cannot distinguish "terminal says no" from "nobody was listening",
      // so absence of a kitty/sixel reply must NOT be read as a negative.
      detected.answered = detected.sawDA1 === true;
      if (!detected.answered) {
        line();
        line('    ' + C.b + 'NOTE:' + C.r + ' the Primary-DA sentinel never came back (' + recognized +
          ' recognised replies). Treating ALL query results as UNKNOWN and falling');
        line('    back to environment heuristics. A live terminal always answers DA1;');
        line('    if you see this in a real terminal, retry with --timeout=1500.');
      }
    }
  }

  // -------------------------------------------------------------------------
  if (DO_VISUAL) renderSwatches();
  // -------------------------------------------------------------------------

  header('5. SUMMARY / RECOMMENDED TIER');
  summary();
}

function renderSwatches() {
  const cols = process.stdout.columns || 80;
  const W = Math.min(64, Math.max(24, cols - 12));
  const img = testImage(16, 16);
  const inTmux = !!E.TMUX || FORCE_TMUX;

  header('4. VISUAL SWATCHES  (report which of these render correctly)');
  line('  ' + C.d + 'Every row ends in "|". If a "|" is out of line with the others, that' + C.r);
  line('  ' + C.d + "row's glyphs are the wrong width in your font." + C.r);
  line();

  // --- [1] truecolor gradient ---
  line(C.b + '  [1] TRUECOLOR gradient (SGR 38;2;r;g;b) — should be perfectly smooth' + C.r);
  let s = '  ';
  for (let i = 0; i < W; i++) { const [r, g, b] = hsv(i / W, 0.85, 1); s += bg24(r, g, b) + ' '; }
  line(s + RST + '|');

  // --- [2] truecolor discrimination ---
  line(C.b + '  [2] TRUECOLOR DISCRIMINATION — 32 cells, red +2 each step (96..158)' + C.r);
  line('      ' + C.d + 'smooth ramp = REAL truecolor.  2-4 flat bands = faked (quantized to 256).' + C.r);
  s = '  ';
  for (let i = 0; i < 32; i++) { const v = 96 + i * 2; s += bg24(v, 40, 40) + ' '; }
  line(s + RST + '|');

  // --- [3] 256-color ---
  line(C.b + '  [3] 256-COLOR cube strip (SGR 48;5;n)' + C.r);
  s = '  ';
  for (let i = 0; i < W; i++) { const [r, g, b] = hsv(i / W, 0.85, 1); s += bg256(r, g, b) + ' '; }
  line(s + RST + '|');
  s = '  ';
  for (let i = 0; i < 24; i++) s += `\x1b[48;5;${232 + i}m `;
  line(s + RST + C.d + '  <- 24-step grayscale ramp 232..255' + C.r);

  // --- [4] 16-color ---
  line(C.b + '  [4] 16-COLOR (SGR 40-47 / 100-107)' + C.r);
  s = '  ';
  for (let i = 0; i < 8; i++) s += `\x1b[4${i}m  `;
  for (let i = 0; i < 8; i++) s += `\x1b[10${i}m  `;
  line(s + RST + '|');

  // --- [5] half blocks, truecolor ---
  line(C.b + '  [5] HALF-BLOCK image  U+2580 "▀" fg=top px, bg=bottom px, TRUECOLOR' + C.r);
  line('      ' + C.d + 'this is the universal high-quality fallback: 2 pixels per cell' + C.r);
  for (let y = 0; y < img.h; y += 2) {
    let row = '      ';
    for (let x = 0; x < img.w; x++) {
      const t = img.at(x, y), b = img.at(x, y + 1);
      row += fg24(t[0], t[1], t[2]) + bg24(b[0], b[1], b[2]) + '▀';
    }
    line(row + RST + '|');
  }

  // --- [6] half blocks, 256 ---
  line(C.b + '  [6] HALF-BLOCK image, same picture in 256-COLOR (Apple Terminal path)' + C.r);
  for (let y = 0; y < img.h; y += 2) {
    let row = '      ';
    for (let x = 0; x < img.w; x++) {
      const t = img.at(x, y), b = img.at(x, y + 1);
      row += fg256(t[0], t[1], t[2]) + bg256(b[0], b[1], b[2]) + '▀';
    }
    line(row + RST + '|');
  }

  // --- [7] quadrants ---
  line(C.b + '  [7] QUADRANT blocks U+2596..U+259F + friends (2x2 px/cell)' + C.r);
  line('      ' + '▘▝▀▖▌▞▛▗▚▐▜▄▙▟█' + '  |');

  // --- [8] sextants ---
  line(C.b + '  [8] SEXTANT blocks U+1FB00..U+1FB3B (2x3 px/cell, Unicode 13)' + C.r);
  s = '      ';
  for (let i = 0; i < 30; i++) s += String.fromCodePoint(0x1fb00 + i);
  line(s + '  |');

  // --- [9] octants ---
  line(C.b + '  [9] OCTANT blocks U+1CD00..U+1CDE5 (2x4 px/cell, Unicode 16, brand new)' + C.r);
  s = '      ';
  for (let i = 0; i < 30; i++) s += String.fromCodePoint(0x1cd00 + i);
  line(s + '  |');

  // --- [10] braille ---
  line(C.b + '  [10] BRAILLE U+2800.. (2x4 px/cell, monochrome, very widely supported)' + C.r);
  s = '      ';
  for (let i = 0; i < 30; i++) s += String.fromCodePoint(0x2800 + i * 8 + 1);
  line(s + '  |');

  // --- [11] shades + powerline ---
  line(C.b + '  [11] SHADE blocks + box drawing + Powerline PUA (U+E0B0..)' + C.r);
  line('      ' + '░▒▓█ ┌─┬┐│└┴┘  ' + '  |');

  // --- [12] kitty graphics ---
  line();
  line(C.b + '  [12] KITTY GRAPHICS PROTOCOL — 16x16 RGB color wheel scaled to 10x5 cells' + C.r);
  line('       ' + C.d + 'expect a small color wheel. Garbage text / nothing = unsupported.' + C.r);
  {
    const { W: iw, H: ih, buf } = imageToRGBBuffer(img, 1); // 16x16
    const b64 = buf.toString('base64'); // 768 bytes -> 1024 chars, under kitty's 4096 chunk limit
    const seq = `\x1b_Ga=T,f=24,s=${iw},v=${ih},c=10,r=5,q=2;${b64}\x1b\\`;
    out('       ');
    out(inTmux ? tmuxWrap(seq) : seq);
    out('\n\n\n\n\n');
    if (inTmux) line('       ' + C.d + '(wrapped in tmux DCS passthrough; needs `set -g allow-passthrough on`)' + C.r);
  }

  // --- [13] iTerm2 OSC 1337, ST terminator ---
  line(C.b + '  [13] iTerm2 OSC 1337 inline image, ST (ESC \\) terminator' + C.r);
  const png = encodePNG(16, 16, imageToRGBBuffer(img, 1).buf);
  const pngB64 = png.toString('base64');
  {
    const seq = `\x1b]1337;File=inline=1;width=10;height=5;preserveAspectRatio=0;size=${png.length}:${pngB64}\x1b\\`;
    out('       ');
    out(inTmux ? tmuxWrap(seq) : seq);
    out('\n\n\n\n\n');
  }

  // --- [14] iTerm2 OSC 1337, BEL terminator ---
  line(C.b + '  [14] iTerm2 OSC 1337 inline image, BEL (\\x07) terminator — same image' + C.r);
  line('       ' + C.d + 'if [14] works but [13] does not, that terminal requires BEL.' + C.r);
  {
    const seq = `\x1b]1337;File=inline=1;width=10;height=5;preserveAspectRatio=0;size=${png.length}:${pngB64}\x07`;
    out('       ');
    out(inTmux ? tmuxWrap(seq) : seq);
    out('\n\n\n\n\n');
  }

  // --- [15] sixel ---
  line(C.b + '  [15] SIXEL — 60x24px, left half red, right half blue' + C.r);
  {
    // DCS P1;P2;P3 q  "aspectNum;aspectDen;width;height  #reg;2;R%;G%;B%  data  ST
    let sx = '\x1bP0;1;0q"1;1;60;24';
    sx += '#0;2;90;18;18#1;2;18;40;90';
    const band = '#0!30~$#1!30?!30~';
    sx += band + '-' + band + '-' + band + '-' + band;
    sx += '\x1b\\';
    out('       ');
    out(inTmux ? tmuxWrap(sx) : sx);
    out('\n\n\n\n\n');
  }

  line('  ' + C.d + 'End of swatches. Blank gaps above are reserved image space —' + C.r);
  line('  ' + C.d + 'if a gap is empty, that protocol is not supported here.' + C.r);
}

function summary() {
  const tn = (E.TERM_PROGRAM || '').toLowerCase();
  const term = (E.TERM || '').toLowerCase();

  const envKitty = !!(E.KITTY_WINDOW_ID || /kitty/.test(term) || E.GHOSTTY_RESOURCES_DIR || E.GHOSTTY_BIN_DIR || tn === 'ghostty' || E.WEZTERM_PANE || tn === 'wezterm' || (E.KONSOLE_VERSION && +E.KONSOLE_VERSION >= 220400));
  const envITerm = !!(E.ITERM_SESSION_ID || tn === 'iterm.app' || E.LC_TERMINAL === 'iTerm2' || E.WEZTERM_PANE || E.MINTTY_SHORTCUT || tn === 'rio');
  const envSixel = /vt340|mlterm|foot|contour|xterm-sixel/.test(term) || !!E.FOOT_VERSION || !!E.CONTOUR_PROFILE;
  const appleTerm = tn === 'apple_terminal';
  const inTmux = !!E.TMUX;
  const inScreen = !!E.STY;
  const overSSH = !!(E.SSH_TTY || E.SSH_CONNECTION);

  const kitty = detected.kitty === true || (detected.answered !== true && envKitty);
  const sixel = detected.sixelDA === true || (detected.answered !== true && envSixel);
  const iterm = envITerm;

  const truecolor = !appleTerm && (E.COLORTERM === 'truecolor' || E.COLORTERM === '24bit' || envKitty || envITerm);
  const c256 = truecolor || /256/.test(term) || appleTerm || !!term;

  const src = detected.answered ? '(MEASURED)' : '(env guess — terminal never answered)';
  kv('evidence quality', detected.answered ? 'measured (DA1 sentinel returned)' : 'heuristic only',
    detected.answered ? '' : 'run this directly in the terminal, not through a pipe');
  kv('terminal guess', E.TERM_PROGRAM || E.TERM || 'unknown', detected.xtversion || '');
  kv('kitty graphics', kitty ? 'YES' : 'no', detected.answered ? '(MEASURED via APC a=q)' : src);
  kv('sixel', sixel ? 'YES' : 'no', detected.answered ? '(MEASURED, DA1 ";4")' : src);
  kv('iTerm2 OSC 1337', iterm ? 'likely' : 'no', '(not queryable — must be judged visually)');
  kv('truecolor', truecolor ? 'YES' : 'no', appleTerm ? 'Apple Terminal HARD-CAPPED to 256' : '');
  kv('256-color', c256 ? 'YES' : 'no');
  kv('cell px', detected.cellW ? detected.cellW + 'x' + detected.cellH : 'unknown', 'needed to size images in cells');
  kv('sync output 2026', detected.sync === undefined ? 'unknown' : detected.sync ? 'YES' : 'no', 'flicker-free frame commits');
  if (inTmux) kv('WARNING', 'inside tmux', 'graphics need DCS passthrough + allow-passthrough on');
  if (inScreen) kv('WARNING', 'inside GNU screen', 'screen mangles/blocks most graphics protocols');
  if (overSSH) kv('NOTE', 'over SSH', 'graphics still work — they are just bytes — but bandwidth matters');

  line();
  let tier, why;
  if (kitty) { tier = 'TIER 1 — Kitty graphics protocol (true pixels, best quality)'; why = 'fall back to half-blocks when the protocol errors out'; }
  else if (iterm && !sixel) { tier = 'TIER 2 — iTerm2 OSC 1337 inline images (true pixels)'; why = 'confirm visually with swatch [13]/[14]'; }
  else if (sixel) { tier = 'TIER 3 — Sixel (true pixels, lower color fidelity)'; why = 'check color-register count from XTSMGRAPHICS above'; }
  else if (truecolor) { tier = 'TIER 4 — Unicode half-blocks ▀ with truecolor fg+bg (2 px/cell)'; why = 'try sextants/octants only if swatches [8]/[9] rendered at 1 cell wide'; }
  else if (c256) { tier = 'TIER 5 — Unicode half-blocks ▀ with 256-color fg+bg (2 px/cell)'; why = 'Apple Terminal lives here; quantize with rgbTo256()'; }
  else { tier = 'TIER 6 — ASCII / braille, monochrome'; why = 'last resort'; }

  line('  ' + C.b + tier + C.r);
  line('  ' + C.d + why + C.r);
  line();
  line('  ' + C.d + 'IMPORTANT: the tier above is a machine guess. The ground truth is which' + C.r);
  line('  ' + C.d + 'of swatches [12]..[15] actually drew a picture. Report those back.' + C.r);
  line();
}

main().then(
  () => process.exit(0),
  (e) => {
    try { process.stdin.setRawMode(false); } catch {}
    line('\n' + C.b + 'PROBE ERROR:' + C.r + ' ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  }
);
