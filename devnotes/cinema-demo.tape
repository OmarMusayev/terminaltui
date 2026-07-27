# The cinema demo, recorded as a GIF.
#
# This is the "show me it works" artifact: boot, open the page, press Space,
# watch Sintel play in coloured quadrant cells, then scrub with the arrows.
#
# Sized 1200x760 rather than full-screen because the GIF has to stay openable —
# every frame of a terminal video is a frame of the recording too.
Output devnotes/screenshots/cinema-demo.gif
Set FontSize 14
Set Width 1200
Set Height 760
Set Padding 12
Set Shell zsh
Set Framerate 12

Type "npx tsx src/cli/index.ts dev demos/cinema/config.ts"
Enter
Sleep 9s

# Into "Now playing". Focus lands on the video's transport (its only slot).
Enter
Sleep 2500ms

# Play.
Space
Sleep 6s

# Pause, scrub back, play again — proves the transport is live, not a loop.
Space
Sleep 800ms
Left
Sleep 400ms
Left
Sleep 400ms
Left
Sleep 800ms
Space
Sleep 4s
