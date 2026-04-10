Output assets/recordings/dashboard.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set Theme "Dracula"

Hide
Type "npx tsx src/cli/index.ts dev demos/dashboard/site.config.ts"
Enter
Sleep 8s
Show

# Home page — hacker theme, menu visible
Sleep 2s

# Enter first page (home/stats)
Enter
Sleep 2s

# Spatial nav across stat cards
Down
Sleep 300ms
Right
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms
Left
Sleep 500ms

# Scroll down to more content
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms

# Back to menu
Escape
Sleep 800ms

# Navigate to Posts
Down
Sleep 200ms
Enter
Sleep 2s

# Scroll posts
Down
Sleep 300ms
Down
Sleep 300ms

# Enter a post detail
Enter
Sleep 2s

# Scroll post
Down
Sleep 300ms
Down
Sleep 300ms

# Back to posts
Escape
Sleep 800ms

# Back to home
Escape
Sleep 1s

Type "q"
Sleep 500ms
