# Headless capture of the Odyssey demo. Run FROM THE REPO ROOT:
#   vhs devnotes/odyssey-shot.tape
#
# VHS drives xterm.js, which has no kitty graphics support, so this always
# exercises the CELL path — which is exactly what Apple Terminal now gets.
# TERMINALTUI_GRAPHICS=off makes that explicit instead of relying on a probe
# timing out, and COLORTERM=truecolor pins the 24-bit path so the capture is
# deterministic rather than dependent on the host terminal.
#
# The `Output ... .gif` line is load-bearing: without an Output directive VHS
# silently no-ops every Screenshot. Paths must be relative — its parser rejects
# absolute ones.
#
# Navigation model: launch lands on the menu; Down/Up move the selection,
# Enter opens, Escape returns.

Output devnotes/screenshots/odyssey.gif
Set Shell zsh
Set FontSize 14
Set Width 1300
Set Height 1150
Set Padding 20
Set TypingSpeed 15ms
Set Theme "Builtin Dark"

Type "TERMINALTUI_GRAPHICS=off COLORTERM=truecolor npx tsx src/cli/index.ts dev demos/odyssey/config.ts"
Enter
Sleep 12s

# ── Page 1: the presentation ──────────────────────────────
Enter
Sleep 5s
Screenshot devnotes/screenshots/odyssey-home.png

Escape
Sleep 2s

# ── Page 2: the gauge ladder, climbed from Super 8 to IMAX ─
Down
Sleep 500ms
Enter
Sleep 4s

# 8 -> 64 columns is 56 cells at FRAME_STEP_COLS (4) = 14 presses.
Type "++++++++++++++"
Sleep 4s
Screenshot devnotes/screenshots/odyssey-imax.png

Escape
Sleep 2s

# ── Page 3: every print stock ─────────────────────────────
Down
Sleep 500ms
Down
Sleep 500ms
Enter
Sleep 6s
Screenshot devnotes/screenshots/odyssey-stocks.png
