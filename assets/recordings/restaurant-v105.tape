Output assets/recordings/restaurant.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx src/cli/index.ts dev demos/restaurant/site.config.ts"
Enter
Sleep 5s
Sleep 2s

# Home page with menu
Sleep 1s

# Enter Menu page (first item)
Enter
Sleep 2s

# Navigate through tabs (menu categories)
Down
Sleep 300ms
Enter
Sleep 1s
Down
Sleep 300ms
Enter
Sleep 1s

# Scroll through menu items
Down
Sleep 400ms
Down
Sleep 400ms

# Back to home
Escape
Sleep 1s

# Navigate to Hours
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms
Enter
Sleep 2s

# Show columns layout — spatial nav between hours and location
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
