# Testing

terminaltui includes `TUIEmulator`, a headless terminal emulator for automated testing. Think Puppeteer, but for terminal apps.

## Setup

Import from the `terminaltui/emulator` subpath:

```ts
import { TUIEmulator } from "terminaltui/emulator";
```

The emulator requires `node-pty` as a peer dependency:

```bash
npm install node-pty
```

## Launching

```ts
const emu = await TUIEmulator.launch({
  command: "terminaltui dev",
  cwd: "./my-site",
  cols: 80,         // terminal width (default: 80)
  rows: 24,         // terminal height (default: 24)
  timeout: 30000,   // kill after timeout in ms
});
```

## Waiting

```ts
await emu.waitForBoot();                           // wait for boot animation to finish
await emu.waitForText("About");                    // wait for text to appear on screen
await emu.waitForTextGone("Loading...");           // wait for text to disappear
await emu.waitForIdle(500);                        // wait for screen to stabilize (no changes for 500ms)
await emu.waitFor(() => emu.screen.contains("Ready")); // custom condition
```

## Input

```ts
await emu.press("down");                           // single key press
await emu.press("down", { times: 3 });             // press multiple times
await emu.pressSequence(["down", "down", "enter"]); // key sequence
await emu.type("hello world");                     // type text
await emu.navigateTo("About");                     // navigate to page by menu name
```

## Screen Queries

```ts
emu.screen.text();                  // full screen as plain text
emu.screen.ansi();                  // full screen as ANSI string (with colors)
emu.screen.contains("text");        // check if text is visible
emu.screen.find("text");            // find text position ({row, col} or null)
emu.screen.currentPage();           // current page name
emu.screen.menu();                  // menu items and selected index
emu.screen.cards();                 // all visible cards
emu.screen.links();                 // all visible links
```

## Assertions

```ts
emu.assert.textVisible("About");    // throws if text is not on screen
emu.assert.noOverflow();            // throws if any content overflows the viewport
```

## Screenshots and Snapshots

```ts
emu.screenshot();                   // ANSI screenshot string (pasteable)
emu.snapshot();                     // { text, ansi, timestamp }
```

## Cleanup

```ts
await emu.close();                  // shut down the emulator
```

## Complete Test Example

```ts
import { TUIEmulator } from "terminaltui/emulator";

async function testSite() {
  const emu = await TUIEmulator.launch({
    command: "terminaltui dev",
    cwd: "./my-site",
    cols: 80,
    rows: 24,
  });

  try {
    await emu.waitForBoot();

    // Verify home page loaded
    emu.assert.textVisible("Home");
    emu.assert.noOverflow();

    // Navigate to About page
    await emu.press("down");
    await emu.press("enter");
    await emu.waitForText("About");
    emu.assert.textVisible("About");

    // Check that cards rendered
    const cards = emu.screen.cards();
    if (cards.length === 0) throw new Error("No cards found on About page");

    // Navigate back
    await emu.press("escape");
    await emu.waitForText("Home");

    // Test search input
    await emu.navigateTo("Search");
    await emu.waitForText("Search");
    await emu.press("enter");
    await emu.type("projects");
    await emu.waitForText("Projects");

    console.log("All tests passed.");
  } finally {
    await emu.close();
  }
}

testSite();
```

## CLI Testing

Run tests from the command line:

```bash
terminaltui test                        # run tests at default width (80)
terminaltui test --cols=120             # test at specific width
terminaltui test --sizes                # test at multiple widths: 40, 80, 120, 200
terminaltui test --sizes --verbose      # show screen output during tests
```
