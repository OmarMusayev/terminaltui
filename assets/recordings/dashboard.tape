# dashboard.gif — Dashboard with live data
# Run: vhs dashboard.tape

Output dashboard.gif
Set Shell zsh
Set FontSize 14
Set Width 1200
Set Height 800
Set Padding 20

Type "npx tsx src/cli/index.ts dev demos/dashboard/site.config.ts"
Enter
Sleep 4s

# Dashboard loads data
Sleep 2s

# Navigate to Posts
Down
Enter
Sleep 1.5s

# Scroll through posts
Down
Sleep 0.5s
Down
Sleep 0.5s
Down
Sleep 0.5s

# Select a post — navigate to detail route
Enter
Sleep 2s

# Back
Left
Sleep 1s

# Back to home
Left
Sleep 1s

Type "q"
Sleep 0.5s
