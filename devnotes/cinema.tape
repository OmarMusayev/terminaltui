# Photographs the cinema demo: poster, then playback.
#
# TERMINALTUI_VIDEO is deliberately NOT set to off here — this tape exists to
# prove the picture moves, so it opts back into the thing the emulator disables.
# Space starts playback; the two screenshots are ~1.5 s apart, so if they are
# identical the clock is not running.
Output devnotes/screenshots/cinema.gif
Set FontSize 13
Set Width 1600
Set Height 900
Set Padding 10
Set Shell zsh

Type "npx tsx src/cli/index.ts dev demos/cinema/config.ts"
Enter
Sleep 9s
# Into the "Now playing" page, then down onto the video (the transport is the
# page's only focus slot, so one Down lands on it).
Enter
Sleep 2s
Screenshot devnotes/screenshots/cinema-poster.png

Space
Sleep 1200ms
Screenshot devnotes/screenshots/cinema-play-a.png
Sleep 1500ms
Screenshot devnotes/screenshots/cinema-play-b.png
