# The CI that caught its own bug

*2026-06-01 · terminaltui 1.8.2*

terminaltui shipped with a `tests-2142` badge in the README. Impressive number. It was also a lie of omission: nothing ran those 2,142 assertions automatically. No CI. The badge was a static PNG — a green checkmark with no check behind it.

So I added the missing piece: a GitHub Actions workflow that runs typecheck + test + build across Ubuntu (node 18/20/22), macOS, and Windows, plus a `prepublishOnly` guard so a broken build can't reach npm.

**The first run failed.**

Not on flakiness. On a real bug.

Two suites went red on the GitHub runners — `Inputs` and `Emulator Integration` — while staying green on my Mac. The classic "works on my machine." The error: `Text "Selected" is not bold`.

Here's the bug. terminaltui detects terminal color support from the environment (`COLORTERM`, `TERM`, …), and it exported its text attributes like this:

```ts
export const bold = colorMode === "none" ? "" : "\x1b[1m";
```

A `const`. Evaluated **once**, at module load, from whatever color mode was detected at import time. My shell has `COLORTERM=truecolor`, so `bold` froze to `"\x1b[1m"` and everything worked. GitHub's runners have a bare environment — no `COLORTERM`, no `TERM` — which detects as `"none"`, so `bold` froze to `""`. Forever. And critically: calling `setColorMode("256")` afterward did nothing, because the value was already baked in.

That's not just a test problem. terminaltui hosts apps over SSH, and it sets the color mode **per connection** based on each client's `TERM`. With the attributes frozen at server startup, a client on a truecolor terminal could get no bold — or a no-color client could get escape codes it can't render. The tests passed for ages because they happened to run in a colorful shell. CI ran them in a bare one, and the bug fell out on the first try.

The fix is small — make them live bindings, recomputed when the mode changes:

```ts
export let bold = colorMode === "none" ? "" : "\x1b[1m";
// ...recomputed inside setColorMode()
```

There was a bonus gremlin, too. Running the suite under node 18 locally "failed" typecheck with `Cannot find type definition file for 'estree 2'`. That turned out to be iCloud — the project lives on a synced Desktop, and iCloud had quietly created dozens of duplicate `* 2` folders inside `node_modules`, which TypeScript dutifully tried to load as type libraries. Not a node-18 bug. Not a code bug. A filesystem ghost. (CI, with its fresh checkout, never sees it.)

The lesson I keep relearning: **a test count is a claim; CI is the proof.** 2,142 assertions tell you nothing about whether they pass anywhere but the machine that wrote them. The moment they ran in an environment I didn't control, they earned their keep — by failing.
