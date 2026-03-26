Output assets/recordings/band.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx demos/band/site.config.ts"
Enter
Sleep 5s
Sleep 2s

# Home page with rosePine theme
Sleep 1s

# Enter Discography
Enter
Sleep 2s

# Navigate album cards — spatial nav between columns
Down
Sleep 400ms
Right
Sleep 800ms
Down
Sleep 400ms
Left
Sleep 800ms

# Back
Escape
Sleep 1s

# Navigate to Shows
Down
Sleep 300ms
Enter
Sleep 2s

# Scroll through tour dates
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
