Output assets/recordings/dashboard.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx demos/dashboard/site.config.ts"
Enter
Sleep 5s
Sleep 2.5s

# Home page — hacker theme, stat cards visible
Sleep 1.5s

# Navigate down through stat cards
Down
Sleep 400ms
Down
Sleep 400ms

# Spatial nav — move right across stat cards
Right
Sleep 800ms
Right
Sleep 800ms
Right
Sleep 800ms
Left
Sleep 600ms
Left
Sleep 600ms

# Navigate down to main content area
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Navigate to Posts page
Escape
Sleep 800ms
Down
Sleep 300ms
Enter
Sleep 2s

# Scroll through posts
Down
Sleep 400ms
Down
Sleep 400ms

# Enter a post detail (parameterized route)
Enter
Sleep 2.5s

# Scroll post content
Down
Sleep 400ms
Down
Sleep 400ms

# Back to posts
Escape
Sleep 1s

# Back to home
Escape
Sleep 1.5s

# Quit
Type "q"
Sleep 1s
