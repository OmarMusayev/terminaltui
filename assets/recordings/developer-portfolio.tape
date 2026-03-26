Output assets/recordings/developer-portfolio.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx demos/developer-portfolio/site.config.ts"
Enter
Sleep 5s
Sleep 2s

# Home page visible with menu
Sleep 1s

# Navigate to Projects
Down
Sleep 400ms
Enter
Sleep 2s

# Spatial nav — move between project cards in grid
Down
Sleep 400ms
Right
Sleep 800ms
Right
Sleep 800ms
Left
Sleep 600ms

# Back to home
Escape
Sleep 1s

# Navigate to About
Down
Sleep 300ms
Down
Sleep 300ms
Enter
Sleep 2s

# Scroll through about content (skill bars, timeline)
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Back to home
Escape
Sleep 1.5s

# Quit
Type "q"
Sleep 1s
