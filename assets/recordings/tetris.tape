Output assets/recordings/tetris.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 30ms
Set Theme "Dracula"

Type "npx tsx demos/tetris/index.ts"
Enter
Sleep 3s

# Title screen visible — press Enter to start
Enter
Sleep 1.5s

# Play! Move pieces around, drop some
Left
Sleep 200ms
Left
Sleep 200ms
Down
Sleep 200ms
Down
Sleep 200ms
Down
Sleep 200ms
Space
Sleep 600ms

# Next piece
Right
Sleep 200ms
Right
Sleep 200ms
Right
Sleep 200ms
Up
Sleep 200ms
Space
Sleep 600ms

# Next piece
Left
Sleep 200ms
Up
Sleep 200ms
Down
Sleep 200ms
Down
Sleep 200ms
Space
Sleep 600ms

# Next piece
Down
Sleep 150ms
Down
Sleep 150ms
Down
Sleep 150ms
Down
Sleep 150ms
Space
Sleep 600ms

# Move and rotate
Left
Sleep 200ms
Left
Sleep 200ms
Left
Sleep 200ms
Up
Sleep 200ms
Space
Sleep 600ms

# Keep playing
Right
Sleep 200ms
Right
Sleep 200ms
Up
Sleep 200ms
Space
Sleep 600ms

# More
Left
Sleep 200ms
Down
Sleep 150ms
Down
Sleep 150ms
Down
Sleep 150ms
Space
Sleep 600ms

# A few more quick drops
Up
Sleep 200ms
Right
Sleep 200ms
Space
Sleep 600ms

Left
Sleep 200ms
Left
Sleep 200ms
Space
Sleep 600ms

Right
Sleep 200ms
Right
Sleep 200ms
Right
Sleep 200ms
Space
Sleep 600ms

# Let it play a bit with gravity
Sleep 1s
Left
Space
Sleep 600ms

Right
Right
Space
Sleep 600ms

Up
Space
Sleep 600ms

Sleep 1.5s

# Quit
Type "q"
Sleep 2s
