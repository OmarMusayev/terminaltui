#!/bin/zsh
# Photograph a terminaltui app running in a REAL kitty window.
#
# Why this exists: VHS renders with xterm.js, which does NOT implement the kitty
# graphics protocol, so it can verify the cell tiers but is blind to the kitty
# tier. This drives an actual kitty instance over its remote-control socket.
#
#   ./devnotes/kitty-shot.sh <out> <config.ts> [keys] [boot] [after] [keys-2] [after-2] [record-seconds]
# e.g.
#   ./devnotes/kitty-shot.sh /tmp/a.png demos/cinema/config.ts $'\r' 5 1 ' ' 1
#   ./devnotes/kitty-shot.sh /tmp/a.mp4 demos/cinema/config.ts $'\r' 5 1 ' ' 0 3
set -eu
OUT="${1:?usage: kitty-shot.sh out config.ts [keys] [boot] [after] [keys-2] [after-2] [record-seconds]}"
CFG="${2:?}"; KEYS="${3:-$'\r'}"; BOOT="${4:-5}"; AFTER="${5:-2}"
KEYS_2="${6:-}"; AFTER_2="${7:-0}"
RECORD_SECONDS="${8:-4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOCK_DIR="$(mktemp -d /private/tmp/terminaltui-kitty-shot.XXXXXX)"
SOCK="$SOCK_DIR/control.sock"
KITTY=/Applications/kitty.app/Contents/MacOS/kitty
KITTEN=/Applications/kitty.app/Contents/MacOS/kitten
KPID=""
FRAME_DIR=""

cleanup() {
  "$KITTEN" @ --to "unix:$SOCK" close-window >/dev/null 2>&1 || true
  [ -z "$KPID" ] || kill "$KPID" >/dev/null 2>&1 || true
  [ ! -S "$SOCK" ] || unlink "$SOCK"
  if [ -n "$FRAME_DIR" ] && [ -d "$FRAME_DIR" ]; then
    find "$FRAME_DIR" -type f -delete
    rmdir "$FRAME_DIR" >/dev/null 2>&1 || true
  fi
  rmdir "$SOCK_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

/usr/bin/env -u NO_COLOR -u CODEX_CI \
  TERMINALTUI_GRAPHICS=kitty TERMINALTUI_VIDEO=on \
  "$KITTY" -o allow_remote_control=yes -o font_size=13 \
  -o initial_window_width=1100 -o initial_window_height=1000 \
  --listen-on "unix:$SOCK" --directory "$ROOT" \
  zsh -c "npx tsx src/cli/index.ts dev $CFG" >/dev/null 2>&1 &
KPID=$!

for _ in {1..100}; do
  [ -S "$SOCK" ] && break
  sleep 0.1
done
[ -S "$SOCK" ] || { echo "kitty remote-control socket did not open" >&2; exit 1; }

sleep "$BOOT"
[ -n "$KEYS" ] && "$KITTEN" @ --to "unix:$SOCK" send-text "$KEYS" 2>/dev/null || true
sleep "$AFTER"
[ -n "$KEYS_2" ] && "$KITTEN" @ --to "unix:$SOCK" send-text "$KEYS_2" 2>/dev/null || true
[ "$AFTER_2" = "0" ] || sleep "$AFTER_2"

# Capture only the kitty window. The previous whole-screen capture leaked
# unrelated desktop state into a development artifact and made comparison
# depend on whatever happened to be behind the terminal.
WINDOW_ID="$(
  "$KITTEN" @ --to "unix:$SOCK" ls |
    node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => { const x = JSON.parse(s); process.stdout.write(String(x[0]?.platform_window_id ?? "")); });'
)"
[ -n "$WINDOW_ID" ] || { echo "kitty platform window id unavailable" >&2; exit 1; }
case "$OUT" in
  *.mp4)
    # macOS's native window-video recorder drops kitty's GPU image plane even
    # though still screenshots include it. Sample targeted window stills and
    # encode those instead, so the proof actually contains the pixel frames.
    CAPTURE_FPS=8
    FRAME_COUNT=$((RECORD_SECONDS * CAPTURE_FPS))
    FRAME_DIR="$(mktemp -d /private/tmp/terminaltui-kitty-frames.XXXXXX)"
    i=1
    while [ "$i" -le "$FRAME_COUNT" ]; do
      frame_file="$(printf '%s/frame-%04d.png' "$FRAME_DIR" "$i")"
      screencapture -x -l "$WINDOW_ID" "$frame_file"
      sleep 0.075
      i=$((i + 1))
    done
    ffmpeg -hide_banner -v error -y -framerate "$CAPTURE_FPS" \
      -i "$FRAME_DIR/frame-%04d.png" \
      -vf "scale='min(1920,iw)':-2:flags=lanczos" \
      -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart "$OUT"
    ;;
  *)
    screencapture -x -l "$WINDOW_ID" "$OUT"
    ;;
esac
echo "captured $OUT"
