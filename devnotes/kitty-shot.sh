#!/bin/zsh
# Photograph a terminaltui app running in a REAL kitty window.
#
# Why this exists: VHS renders with xterm.js, which does NOT implement the kitty
# graphics protocol, so it can verify the cell tiers but is blind to the kitty
# tier. This drives an actual kitty instance over its remote-control socket.
#
#   ./devnotes/kitty-shot.sh <out.png> <config.ts> [keys-to-send] [boot-wait] [after-wait]
# e.g.
#   ./devnotes/kitty-shot.sh /tmp/a.png demos/pillars/config.ts $'\r' 22 9
set -e
OUT="${1:?usage: kitty-shot.sh out.png config.ts [keys] [boot] [after]}"
CFG="${2:?}"; KEYS="${3:-$'\r'}"; BOOT="${4:-22}"; AFTER="${5:-9}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOCK="/tmp/kitty-shot-$$"
KITTY=/Applications/kitty.app/Contents/MacOS/kitty
KITTEN=/Applications/kitty.app/Contents/MacOS/kitten

"$KITTY" -o allow_remote_control=yes -o font_size=13 \
  -o initial_window_width=1100 -o initial_window_height=1000 \
  --listen-on "unix:$SOCK" --directory "$ROOT" \
  zsh -c "npx tsx src/cli/index.ts dev $CFG" >/dev/null 2>&1 &
KPID=$!
node -e "setTimeout(()=>{},${BOOT}000)"
[ -n "$KEYS" ] && "$KITTEN" @ --to "unix:$SOCK" send-text "$KEYS" 2>/dev/null || true
node -e "setTimeout(()=>{},${AFTER}000)"
screencapture -x "$OUT"
"$KITTEN" @ --to "unix:$SOCK" close-window 2>/dev/null || true
kill $KPID 2>/dev/null || true
rm -f "$SOCK"
echo "captured $OUT"
