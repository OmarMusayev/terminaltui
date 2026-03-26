Output assets/recordings/server-dashboard.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx demos/server-dashboard/site.config.ts"
Enter
Sleep 5s
Sleep 2s

# Home/Overview page — system stats
Sleep 1.5s

# Navigate through stat cards with spatial nav
Down
Sleep 400ms
Right
Sleep 800ms
Right
Sleep 800ms
Down
Sleep 400ms
Left
Sleep 800ms

# Navigate to Containers page
Escape
Sleep 800ms
Down
Sleep 300ms
Enter
Sleep 2s

# Scroll container table
Down
Sleep 400ms
Down
Sleep 400ms

# Back
Escape
Sleep 1s

# Navigate to Network
Down
Sleep 300ms
Down
Sleep 300ms
Enter
Sleep 2s

# Spatial nav on network page
Right
Sleep 800ms
Left
Sleep 600ms

# Back to home
Escape
Sleep 1.5s

# Quit
Type "q"
Sleep 1s
