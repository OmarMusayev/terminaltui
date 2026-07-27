# Capture just the poster page. Run FROM THE REPO ROOT:
#   vhs devnotes/odyssey-poster.tape
# The poster is the first menu item, so a single Enter opens it.

Output devnotes/screenshots/odyssey-poster.gif
Set Shell zsh
Set FontSize 14
Set Width 1300
Set Height 1500
Set Padding 20
Set TypingSpeed 15ms
Set Theme "Builtin Dark"

Type "TERMINALTUI_GRAPHICS=off COLORTERM=truecolor npx tsx src/cli/index.ts dev demos/odyssey/config.ts"
Enter
Sleep 12s

Enter
Sleep 6s
Screenshot devnotes/screenshots/odyssey-poster.png
