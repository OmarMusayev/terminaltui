Output assets/recordings/dashboard.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx src/cli/index.ts dev demos/dashboard/site.config.ts"
Enter
Sleep 5s
Sleep 2.5s

# Dashboard page - data loaded
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Navigate to Posts
Left
Sleep 600ms
Down
Enter
Sleep 1.5s

# Scroll posts
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms

# Click into a post detail route
Enter
Sleep 2.5s

# Scroll comments
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Back
Left
Sleep 1s

# Back to home
Left
Sleep 1s

# Quit
Type "q"
Sleep 1s
