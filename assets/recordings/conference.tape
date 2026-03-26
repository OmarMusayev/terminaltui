Output assets/recordings/conference.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx demos/conference/site.config.ts"
Enter
Sleep 5s
Sleep 2s

# Home page — nord theme
Sleep 1s

# Navigate to Schedule
Down
Sleep 300ms
Down
Sleep 300ms
Enter
Sleep 2s

# Show tabbed schedule
Down
Sleep 300ms
Enter
Sleep 1s

# Back
Escape
Sleep 1s

# Navigate to Speakers
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms
Enter
Sleep 2s

# Spatial nav through speaker grid
Down
Sleep 400ms
Right
Sleep 800ms
Down
Sleep 400ms
Left
Sleep 800ms

# Back to home
Escape
Sleep 1.5s

# Quit
Type "q"
Sleep 1s
