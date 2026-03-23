Output assets/recordings/hero.gif
Set Shell zsh
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20
Set TypingSpeed 50ms
Set Theme "Dracula"

Type "npx tsx src/cli/index.ts dev demo/site.config.ts"
Enter
Sleep 4s
Sleep 2.5s

# On home page - scroll through skills and links
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Go to Resume
Sleep 800ms
Left
Sleep 600ms
Down
Enter
Sleep 1.5s

# Scroll through experience cards
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms
Down
Sleep 400ms

# Go back
Left
Sleep 800ms

# Go to Projects
Down
Down
Enter
Sleep 1.5s

# Scroll projects
Down
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 500ms

# Go back
Left
Sleep 800ms

# Go to Blogs
Down
Down
Down
Enter
Sleep 1.5s

# Click into a blog post
Down
Enter
Sleep 2s

# Scroll the blog post
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms

# Back
Left
Sleep 800ms

# Back to home
Left
Sleep 800ms

# Quit
Type "q"
Sleep 1.5s
