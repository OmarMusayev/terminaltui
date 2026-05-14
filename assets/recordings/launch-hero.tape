# launch-hero.tape — README + social-share hero recording
#
# Walks through `npx terminaltui try` end-to-end. ~35s. Synthwave palette
# matching the JetBrains Mono Nerd Font + Kitty colors Omar uses daily.
#
# Render with:  vhs assets/recordings/launch-hero.tape

Output assets/recordings/launch-hero.gif

Set Shell zsh
Set FontFamily "JetBrainsMono Nerd Font"
Set FontSize 16
Set Width 1600
Set Height 1000
Set Padding 24
Set TypingSpeed 50ms
Set PlaybackSpeed 1.0
Set Theme { "name": "Synthwave", "background": "#1a1028", "foreground": "#f0e4cf", "cursor": "#ff7edb", "cursorAccent": "#1a1028", "selection": "#ff7edb", "black": "#1a1028", "brightBlack": "#3b2d5e", "red": "#f97e72", "brightRed": "#ff8c82", "green": "#72f1b8", "brightGreen": "#95ffd2", "yellow": "#fede5d", "brightYellow": "#f9f871", "blue": "#6fc1ff", "brightBlue": "#8be9fd", "magenta": "#ff7edb", "brightMagenta": "#ff92df", "cyan": "#36f9f6", "brightCyan": "#70fcf6", "white": "#f0e4cf", "brightWhite": "#fefefe" }

# ── Hidden: alias `terminaltui` to our local source so the visible command
#    in the video matches what users will actually run after v1.8.0 ships.
Hide
Type "alias terminaltui='npx tsx /Users/omar/Desktop/Projects/TUI/src/cli/index.ts'"
Enter
Sleep 200ms
Type "clear"
Enter
Sleep 400ms
Show

# ── Hook: invite the viewer
Sleep 800ms
Type "terminaltui try"
Sleep 600ms
Enter

# ── Boot animation + banner reveal
Sleep 5500ms

# ── Home page: pause, then scan with arrow keys
Sleep 1200ms
Down
Sleep 600ms
Down
Sleep 600ms
Down
Sleep 600ms
Up
Sleep 600ms

# ── Jump to Showcase page (menu item 2)
Type "2"
Sleep 2200ms

# Scroll through cards / sparklines / accordion
Down
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms

# ── Themes page — the wow moment, driven by button presses.
#    The page loads with initial focus on the cyberpunk button (row 1
#    left). Spatial nav lets us move around the grid; Enter on a button
#    fires onPress → setTheme(name) → the whole UI re-renders in that
#    palette.
#
#      [cyberpunk] [dracula]
#      [nord]      [monokai]
#      [solarized] [gruvbox]
#      [catppuccin][tokyoNight]
#      [rosePine]  [hacker]
Type "3"
Sleep 2400ms

# Switch to nord (row 2 left). One Down from cyberpunk.
Down
Sleep 700ms
Enter
Sleep 2200ms

# Switch to tokyoNight (row 4 right). Down to solarized, Down to catppuccin,
# Right to tokyoNight.
Down
Sleep 300ms
Down
Sleep 300ms
Right
Sleep 700ms
Enter
Sleep 2200ms

# Switch to hacker (row 5 right). One Down from tokyoNight.
Down
Sleep 700ms
Enter
Sleep 2200ms

# Pop back up to cyberpunk (row 1 left) before leaving the page.
# From hacker (row 5 right) → 4 Ups put us at dracula (row 1 right) → Left = cyberpunk.
Up
Sleep 200ms
Up
Sleep 200ms
Up
Sleep 200ms
Up
Sleep 200ms
Left
Sleep 500ms
Enter
Sleep 1800ms

# ── Live data — let the sparklines actually animate
Type "4"
Sleep 4500ms
Down
Sleep 1200ms
Down
Sleep 1200ms

# ── Get started — close on the install command
Type "5"
Sleep 3000ms

# ── Sign-off
Type "q"
Sleep 1500ms
