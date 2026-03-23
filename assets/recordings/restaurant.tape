# restaurant.gif — Restaurant demo
# Run: vhs restaurant.tape

Output restaurant.gif
Set Shell zsh
Set FontSize 14
Set Width 1200
Set Height 800
Set Padding 20

Type "npx tsx src/cli/index.ts dev demos/restaurant/site.config.ts"
Enter
Sleep 3s

# Browse menu
Enter
Sleep 1s
Down
Sleep 0.5s
Down
Sleep 0.5s
Down
Sleep 0.5s
Down
Sleep 0.5s
Down
Sleep 0.5s

# Go back
Left
Sleep 1s

# Check hours
Down
Down
Down
Enter
Sleep 1.5s

# Go back and quit
Left
Sleep 0.5s
Type "q"
Sleep 0.5s
