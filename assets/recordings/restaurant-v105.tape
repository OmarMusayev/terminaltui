Output assets/recordings/restaurant.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set Theme "Dracula"

Hide
Type "npx tsx src/cli/index.ts dev demos/restaurant/site.config.ts"
Enter
Sleep 8s
Show

# Home page with gruvbox banner
Sleep 2s

# Enter Menu page
Enter
Sleep 1.5s

# Cycle tabs
Down
Sleep 300ms
Enter
Sleep 800ms
Down
Sleep 300ms
Enter
Sleep 800ms

# Scroll items
Down
Sleep 300ms
Down
Sleep 300ms

# Back
Escape
Sleep 800ms

# Navigate to Hours
Down
Sleep 200ms
Down
Sleep 200ms
Down
Sleep 200ms
Enter
Sleep 1.5s

# Spatial nav between columns
Right
Sleep 600ms
Left
Sleep 500ms

# Back to home
Escape
Sleep 1s

Type "q"
Sleep 500ms
