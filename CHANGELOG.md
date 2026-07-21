# Changelog

## [2.0.2] - 2026-07-20

Dynamic routes actually receive their params now. This bug predates the v2 overhaul — any page opened with navigation params (`[id].ts` routes, or a card action with `params`) got `undefined` instead of a context, and function-typed `metadata.label`s were painted into the header as raw source. The dashboard demo's post-detail page showed both symptoms.

### Fixed

- **Content loaders receive navigation params.** The runtime now passes the current route params to a page's content loader on every navigation, and the file-router builds the documented `{ params }` context from them for dynamic routes and any param-carrying navigation. Previously the loader was always called with `undefined` — a `[id].ts` page (or a static page opened via `action: { navigate, params }`) crashed on its params and hung on the loading spinner.
- **Function-typed `metadata.label` resolves at render time.** `label: (p) => \`Post #${p.id}\`` now renders the resolved string in the page header instead of the function's source code. `metadata.loading` gains the same function form and is actually passed through to the page (it was silently dropped before).
- **Params changes invalidate cached page content.** Revisiting a parameterized page with different params shows its loading state instead of the previous params' content, and a slow in-flight load that was superseded by a newer navigation discards its result instead of clobbering it (per-key load generation in the async manager).
- **Param-less search navigation clears stale params.** Jumping to a page via fuzzy search no longer leaves the previous dynamic page's params live on the runtime.
- **Back-navigation restores the params a page was opened with.** History entries now carry their params. Previously, going back to a parameterized page after any forward navigation re-resolved its function label against cleared params — the header read "Post #undefined" over the correct content. Back also re-enters the page lifecycle now, so `refreshInterval` timers restart on back instead of staying dead (cached content for matching params still shows instantly).
- **`terminaltui build` output threads params.** The AOT build's generated entry point called every page function with no arguments — its own parallel loader path, untouched by the dev-router fix — so param pages crashed in built bundles even after the fix above. The generated loaders now build the same `{ params }` context as the dev router, and `metadata.loading` is included in the bundle.
- **Windows CI: the CLI dispatch suite runs.** The suite spawned the extensionless `node_modules/.bin/tsx` shim, which Windows `spawnSync` can't execute without a shell (ENOENT, 0/24). It now invokes tsx's JS entry with the current node binary on all platforms.

### Added

- Regression coverage: a router params suite (23 assertions on context threading, metadata passthrough, history param restore, and build codegen) and a post-detail section in the dashboard QA suite — the first E2E tests that actually open a param-driven route, including the jump-away-and-back round trip.
- `docs/routing.md` documents param-carrying navigation to static pages and the function forms of `metadata.label` / `metadata.loading`.

## [2.0.1] - 2026-07-20

Fixes for the emulator and the test suites, found by running the v2.0.0 CI matrix on Linux, macOS, and Node 18. No changes to the framework runtime — apps behave exactly as on 2.0.0.

### Fixed

- **Emulator: `close()` now kills the whole process tree.** `TUIEmulator.launch({ command })` runs the command through a shell, so a launch like `npx tsx app.ts` is a tree (shell → npx → tsx → node). The child-process fallback signalled only the direct child, which on Linux left the app itself alive holding the emulator's pipe ends open — the calling process would never exit. The fallback now spawns into its own process group and signals the group (`taskkill /T /F` on Windows), then destroys the pipes after escalating to `SIGKILL`.
- **Emulator: launched commands can find locally installed binaries.** `spawnPTY` prepends the host project's `node_modules/.bin` to the child's `PATH`, so a command run from a scratch directory resolves project-local tools instead of falling back to a registry download. The prepend is case-correct on Windows (`Path`), where writing a second `PATH` key broke command resolution entirely.

### Changed

- Test suites launch apps as `tsx run.ts` rather than `npx tsx run.ts`. On a cold npx cache — every fresh CI runner — npx would install `tsx` mid-test and print progress into the emulated terminal, so boot assertions sampled a half-rendered screen.
- Test suites use `dirname(fileURLToPath(import.meta.url))` instead of `import.meta.dirname`, which is undefined on Node 18 (added in 20.11) and crashed suites at module load there. The package's supported range has always been `>= 18`; only the tests were affected.

## [2.0.0] - 2026-07-19

The v2 overhaul. Five waves of work land in one major release: two audit-driven bug-fix passes, a full demo/QA repair, a dead-code and packaging cleanup, a typed core-runtime rewrite with correct component-state keying, and a line-diffed render pipeline that writes 67.7% fewer bytes to the terminal. Same pixels. A third of the bytes. The two behavior changes worth reading before you upgrade are **component state is now keyed by page + tree path instead of display label** and **`ssh2` is now an optional peer dependency** — see Breaking and the migration guide below.

> **Note on 1.9.0:** `package.json` was bumped to 1.9.0 during this work, but 1.9.0 was **never published to npm** — the last release on npm is 1.8.2. There is no intermediate version for anyone to have upgraded through, so 2.0.0 rolls up everything since 1.8.2 (commits `0928dd7`, `0449b00`, `0c54ded`, `eb76224`, `c75aaa5`), including the packaging changes that had been tagged internally as "1.9.0".

### Breaking

- **Component state is keyed by page + tree path, not display label.** Accordion open/closed, active tab, gallery index, and button loading state used to be stored under the component's display label in a shared map. They are now stamped with the page id plus the block's position in the content tree (a walker-assigned path, via a `WeakMap`). Two consequences:
  - **Two components with the same label no longer share state.** Previously an accordion titled `"Details"` on `/faq` and another titled `"Details"` on `/help` toggled together. They are now fully independent.
  - **State survives navigation and refresh.** Previously leaving a page and returning reset that page's accordions/tabs/gallery to their defaults. State now persists across navigation and page refresh. Dynamic (regenerated) subtrees get shape-tolerant keys, so a re-render of the same structure keeps its state instead of resetting.

  Before / after, two same-labeled accordions on different pages:

  ```
  // 1.x — state keyed by label "Details"
  //   expand "Details" on /faq        -> "Details" on /help also shows expanded
  //   navigate /faq -> /home -> /faq   -> "Details" is collapsed again (state lost)

  // 2.0 — state keyed by page + tree path
  //   expand "Details" on /faq        -> "Details" on /help is unaffected (independent)
  //   navigate /faq -> /home -> /faq   -> "Details" is still expanded (state kept)
  ```

- **`ssh2` moved from `optionalDependencies` to an optional `peerDependency`** (install-semantics change). `terminaltui serve` still needs `ssh2`, but it is no longer pulled in transitively — install it in your own project: `npm i ssh2`. `terminaltui dev` and everything else work without it. `serve` resolves `ssh2` via a cwd-aware import fallback so global/`npx` installs find a project-local copy. `node-pty` remains an optional peer as well.

Public exports of `terminaltui` and `terminaltui/emulator` are otherwise unchanged.

### Performance

Wave 5 rewrote the frame writer as a line diff and memoized the two hottest string operations.

- **Terminal bytes written: 269,355 → 87,027 = −67.7%** across a scripted navigation run (per-demo: startup −69.0%, developer-portfolio −66.2%). **Zero-change frames now write 0 bytes** — an unchanged re-render emits nothing.
- **Method:** measured through the emulator against the same PTY backend at 120×40, a 41-keypress scripted navigation, reported as 3-run medians. Correctness was proven by a dual-`VirtualTerminal` oracle that replays both `text()` and `ansi()` output of the old and new writers and asserts the **final on-screen grids are byte-identical** across styled rewrites, overlays, shrink, and resize.
- **How:** `writeToTerminal` is now two-phase — compose the final styled per-row strings (bottom-row overlay precedence preserved), then diff against a previous-frame buffer and emit only changed rows as `CUP` + `EL` + payload. Per-frame `frameState` lives on the runtime instance (one per terminal stream), so concurrent SSH sessions cannot cross-contaminate. Full redraws still happen on the first frame, on any resize, and from every out-of-band writer (error, stop, cleanup, stderr warnings), preserving the legacy self-heal behavior.
- **Width/ANSI memoization:** `stringWidth` is memoized at its single choke point (bounded `Map`, cap 8192 entries, FIFO eviction; strings shorter than 8 chars skip the cache), so every hot caller (`Panel` pad/clip, `truncate`/`wrapText`, the terminal truncation guard) benefits with no call-site edits; `stripAnsi` gained a zero-alloc fast path for strings with no ESC. Output was proven byte-identical before and after memoization (0.0% delta).
- **`PageLayoutCache` (wave 4):** non-volatile pages now skip focus collection, form registration, and rect computation on every frame. Volatile pages (dynamic/async) keep the exact per-frame path; the cache invalidates on page enter, resize, refresh, content-identity change, and a focus-slot fingerprint so in-place mutations still rebuild.

### Fixed

Input, Unicode width, SSH, and data (wave 1 — 36 fixes from a multi-agent audit):

- **Escape-sequence parser is now stateful** — sequences split across stdin chunks parse correctly, surrogate pairs are never split mid-codepoint, and a lone `ESC` is recognized via a 50 ms hold.
- **`SIGINT`/`SIGTERM` now actually exit** (codes 130/143); `cleanup()` no longer tears down process-globals under SSH; the exit cursor position is 1-based. The site `onError` lifecycle hook is now wired into the render, action, and navigation error paths.
- **SSH per-connection session tracking** — one client disconnecting no longer kills other sessions from the same IP; a serve-mode crash guard restores every client's terminal before exit.
- **Text-editing cursor/scroll/wrap math is done in code points and display cells** (new shared `text-cursor` helper), so emoji and CJK are no longer torn or misaligned. `Quote`, `Menu`, gradient lines, scenes, and bar charts compute width via `stringWidth` instead of UTF-16 code units.
- **Data fetching** — the `fetcher` custom-fetch instance leak is fixed (opt-in key option); the SSE parser buffers partial events across chunks and handles CRLF.
- **Emulator vterm gained wide-character support** — 2-column CJK/emoji render with continuation cells.
- **`runtime-pages`** — page refresh timers are cleared on navigation, a background refresh no longer clobbers the current page's focus, and dynamic render errors surface as an error block instead of vanishing.

Demo/QA repair (wave 2 — root-cause framework bugs, not demo typos):

- **`columns()`/`rows()` rejected the documented `panel()` block form** — consumers read `p.content` off the wrong shape and crashed with `blocks is not iterable`. Both shapes now normalize, with a `toBlockArray()` guard at page-content boundaries.
- **Auto-scroll anchored viewport-tall focused blocks to their end**, clipping tab headers off the top; it now anchors to the start.
- **`screen`/`terminal-io` now honor `COLUMNS`/`LINES`** when stdout reports no size, so the emulator's non-PTY fallback renders at the requested size instead of 80×24 (this had been hiding below-the-fold content in every demo).
- **Emulator `resize()` works in the non-PTY fallback** via an in-band `CSI 8;rows;cols t` channel; the launch timeout is inactivity-based instead of an absolute deadline that killed long-running QA suites mid-run.
- The dashboard demo prefetches its data at boot (its loading state was previously unescapable).

Cleanup-pass fixes (wave 3):

- **Command-buffer backspace deletes whole code points** (no surrogate tearing after an emoji), and the printable-char guard accepts astral characters (`codePointLength`, not `.length`).
- **`TextArea`** — the cursor cell at the end of a full line no longer overflows the right border by one column.
- **`Quote`** — fancy-style attribution is width-aware truncated to fit.
- **`detect-terminal`** — a TTY with no `TERM` keeps a 16-color floor; only `NO_COLOR` forces monochrome on a TTY.

Review repairs from the typed-runtime and render-diff work (waves 4–5):

- Late async page loads no longer stamp component state under the wrong page id; non-current-page refresh writebacks no longer store unstamped arrays.
- `findFocusIndexByPanelTitle` is path-based — empty panels return no-jump instead of drifting focus to the next block; panels inside `rows` became title-matchable.
- Overlay controls are sanitized at compose time and C0-except-`ESC` is stripped from every payload, so a stray `\n` in a notification can no longer scroll the screen and desync the frame buffer; out-of-band writers force a heal.

### Changed

- **Input behavior (observable):** `Escape` on the home page is now a no-op instead of quitting (`q`/`Ctrl+C` quit); left-arrow at the leftmost focusable no longer acts as "back" (matches the keybindings design note); returning home resets the menu selection to the first item.
- **Typed core-runtime internals (wave 4):** a new `RuntimeInternal` interface replaces 23 `this as any` casts and 7 per-module ad-hoc runtime interfaces; `serve.ts` writes `runtime.fileRouter` typed.
- **One block walker, one taxonomy (wave 4):** a single pre-order `block-walker` replaces 11 drifting ad-hoc tree walks; `block-taxonomy` centralizes `FOCUSABLE_TYPES` (chat is now focusable, gallery is not — resolving a flex/legacy engine disagreement) and drives the flex engine from the same set. `layout-constants` replaces numerically identical scattered literals.
- **Dead code removed (wave 3):** files `cli/art-commands.ts`, `art-registry/art-helpers.ts`, `components/ScrollView.ts`, `ascii/box-drawing.ts`, `helpers/clipboard.ts`, plus unreferenced exports (`drawBox`/`drawBoxWithTitle`, `gradientText`, `createArtPack`, `getScreenSize`, `getSpinnerFrames`, `shouldStack`, `isTracking`, `styledInverse`, and unused layout types). Each was independently re-verified unreferenced, including dynamic/registry lookups.
- **Duplication consolidated (wave 3, public names/signatures preserved):** `detectTerminal()` delegates color depth to `detectColorSupport()`; the chart helpers are defined once in `dataviz-charts.ts`; `Columns`/`Rows` stacked-panel rendering shares `layout/stacked.ts`; `truncate()`/`truncateLine()` share one width-aware core.
- **Demos** got curated menu order via `metadata.order`/`menu.order`.
- **CI:** the `--demos` E2E job is now a blocking gate (previously advisory/`continue-on-error`); a full-tree `npm audit` step restores `ssh2` advisory coverage.
- **Packaging:** `exports` gained default conditions and `./package.json`; `sideEffects: false`; a prepack build and tarball dupe-guards; `engines.node >= 18` is now declared and documented (ESM-only). `demos/mac-monitor` ships its sources like every other demo.

### Added

- **`TUIEmulator.bytesReceived` and `TUIEmulator.resetBytesReceived()`** — a new public emulator capability (on the `terminaltui/emulator` export) to measure exactly how many bytes a run writes to the terminal. This is how the render benchmark above is taken; you can assert on it in your own tests.
- **New test suites:** `render-diff` (83 tests, incl. the grid-identity oracle and a 0-byte no-op E2E), `width-cache` (90 tests, incl. an 18-entry Unicode corpus checked against an uncached reference after 8k-entry churn), `focus-contract` (a 21-slot fixture covering every container kind, asserting rect count equals focus count against golden paths), and 4 CLI unit suites (+112 tests: create-prompt mapping, command dispatch, project guards, art helpers).
- **Test suite grew from 2,142 to 3,323 tests across 52 suites.** The default subset is 2,440 tests across 33 suites (~20s); the full `--demos` sweep runs the demo/QA E2E suites through a real PTY emulator (~17 min) and is now a blocking CI gate.

### Migration from 1.x

1. **Component state (accordion / tabs / gallery / button loading).** State is now keyed by page + tree path, so:
   - If you relied on **two same-labeled components sharing state**, they no longer do — that was incidental behavior of label-based keying. There is no code change needed unless you were depending on the shared toggle.
   - If you relied on a page's components **resetting when you navigate away and back**, they no longer reset — state persists across navigation and refresh. If you need a component to start fresh, reset it explicitly in your own state rather than expecting navigation to clear it.
2. **SSH hosting (`terminaltui serve`).** `ssh2` is now an optional peer dependency. Add it to your project: `npm i ssh2`. Nothing else changes; `terminaltui dev` does not need it.
3. **Keybindings.** `Escape` no longer quits from the home page — use `q` or `Ctrl+C`. Left-arrow at the leftmost item no longer navigates back.

---

## [1.8.2] - 2026-06-01

Infrastructure and correctness release. Adds a CI pipeline and a publish guard, removes a self-referential dependency that bloated every install, and fixes a color bug where text attributes ignored runtime color-mode changes. CI caught that color bug on its first run — it passed locally but failed on bare-environment runners.

### Fixed

- **`bold`/`dim`/`italic`/`underline`/`inverse`/`reset` ignored `setColorMode()`** — they were evaluated once at module load from the ambient color mode, so any runtime mode change (notably per-SSH-connection color derived from the client's `TERM`) left them frozen to whatever was detected at import. They're now live bindings recomputed by `setColorMode()`.
- **The package depended on itself** — `dependencies` listed `terminaltui`, so every install pulled a nested older copy of the package. Removed; runtime dependencies are now just `esbuild`, matching the README's "1 required dependency."
- **`createPersistentState` test used a hardcoded `/tmp/` path** — now `os.tmpdir()`, so the suite runs on Windows.

### Added

- **CI pipeline** (`.github/workflows/ci.yml`) — typecheck + test + build across Ubuntu (node 18/20/22), macOS, and Windows, plus a production-dependency `npm audit`. The full suite (2,142 assertions) now runs on every push and pull request.
- **`prepublishOnly` guard** — `typecheck && test && build` runs before publish, so a broken build can't ship.

### Changed

- Pinned `tsx` as a devDependency (tests no longer rely on `npx` auto-download).
- Pinned `picomatch` to `^4.0.4` via `overrides` to clear a high-severity advisory in dev tooling.

---

## [1.8.1] - 2026-05-14

Hotfix for v1.8.0. `npx terminaltui try` crashed at startup with `Cannot find module '<pkg>/demos/src/index.js'` — the demos' relative framework imports (`../../src/index.js`) were externalized as literal strings, then resolved relative to the compiled `.mjs`'s location (one level deeper than the source), so the path landed inside `demos/` instead of the package root.

### Fixed

- **`runDemo()` failed when invoked from an installed copy of the package** — added an esbuild `onResolve` plugin in `compileFile` that rewrites any relative `*/src/index.js` (or `.ts`) import to the bare specifier `"terminaltui"`. Node's normal package resolution then finds the framework regardless of where the `.mjs` cache file ends up. Local dev (tsx mode) is unaffected — `compileFile` short-circuits in that mode and never runs esbuild.

---

## [1.8.0] - 2026-05-14

Launch-readiness release. Adds `npx terminaltui try` as a one-command pitch, ships two new bundled demos (`welcome`, `mac-monitor`), exposes `setTheme()` as a runtime helper, and fixes three bugs that surfaced while building the launch tour.

### Added

- **`npx terminaltui try`** — opens a 5-page guided tour of the framework (home, components showcase, themes picker, live data, get-started) in a Synthwave palette. Doubles as a smoke test for someone discovering the framework via README. Source under `demos/welcome/`.
- **`mac-monitor` demo** — bundled real-time macOS system monitor (CPU, memory, processes, network). Lives at `demos/mac-monitor/`; runs with `npx terminaltui dev demos/mac-monitor/site.config.ts`.
- **`setTheme(name)`** is now exported from the package root — call from a button's `onPress` to swap the active theme in-place. Returns `false` if the name isn't recognized; the runtime re-renders on success.
- **Code of Conduct, security policy, PR template** under `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE.md`.

### Fixed

- **`menu-builder` crashed when `metadata.label` was a function** — both `resolveMenuLabel` and the sort comparator assumed string labels, and parameterized routes that derive their menu label at runtime (`label: ({ params }) => …`) threw `a.label.localeCompare is not a function` on first render. Now type-checked + coerced with `String(...)` in the comparator.
- **`:theme tokyoNight` and `:theme rosePine` failed** — `executeCommand` lowercased the entire trimmed input before dispatch, so the camelCase argument never matched the theme registry key. Now splits verb from argument and only lowercases the verb. Added `test/test-commands.test.ts` (+11 assertions) to pin the behavior.
- **Number-key page jumps only worked from the home menu** — README claimed they worked from anywhere; `runtime-input.ts` had an `isHome()` guard that contradicted the docs. Guard removed.
- **`init` scaffolder hardcoded `^1.6.0`** — generated `package.json` files pinned the framework two versions behind. Now reads the framework's own version dynamically by walking up to the nearest `package.json`.

### Changed

- **README repositioned as "Next.js for the terminal"** — added comparison table vs Ink/Pastel/Bubble Tea, hero recording, test-count badge.
- Test count: 2,127 → 2,142 across 26 suites.

### Notes

- Memory: the build hosts a 2,400×1,500 GPU-encoded MP4 + 1,440×900 GIF + 1,600×1,000 social-share PNG under `assets/recordings/`. These are not shipped to npm consumers (not in the `files` array).

---

## [1.7.0] - 2026-05-01

Project-wide review pass. Two production-impacting bugs, multi-session SSH correctness, and a sweep of dead code from the 1.6.0 cleanup that didn't get fully removed.

### Fixed (production bugs)

- **`:theme` command crashed on use** — `runtime-pages.ts` used `require()` inside an ESM-only package; the first `:theme dracula` raised `ReferenceError: require is not defined`. Switched to a static import.
- **`requireEnv` and `rateLimit` middleware were silently bypassed** — `runMiddleware().catch()` fell through to `doNavigate`, so a thrown middleware (which is how both built-ins signal failure) rendered the page anyway. Throws now surface a `Blocked: <message>` feedback line and the navigation aborts.
- **Concurrent SSH sessions clobbered each other** — `_renderCallback`, `_navigateFn`, and `apiBaseUrl` were module-level globals; the most recent `runtime.start()` won, so older sessions' `state.set()` and `navigate()` calls hit the wrong runtime. Added `core/runtime-context.ts` with `AsyncLocalStorage`; helpers consult the active context first and fall back to the legacy global for tests / cross-package fetcher imports.
- **`createPersistentState()` leaked process listeners** — each call added three (`exit`/`SIGINT`/`SIGTERM`) handlers; SSH sessions or hot-reloads triggered `MaxListenersExceededWarning`. Now a single shared exit-flush handler is registered once.
- **`asyncContent` render storm** — the loading branch scheduled `setTimeout(rt.render, 100)` on every render, compounding to N²-style render bursts. One guarded spinner timer per runtime now.
- **`stringWidth` adopted unevenly** — `Timeline.ts`, `Divider.ts`, the inline accordion in `runtime-render.ts`, and `TextInput.ts` masking used `.length` (UTF-16 code units) where they needed display width or codepoint count. CJK and emoji rendered miscounted.
- **`ascii/image.ts` emitted raw 24-bit ANSI** — bypassed the 256-color fallback path, so colored ASCII images rendered as garbage in Apple Terminal. Added `fgColorRgb()` to `style/colors.ts`; image renderers route through it.

### Removed (breaking)

These were either internal-only by design or removed in 1.6.0 but the export survived:

- `componentRegistry`, `Component` (interface), `ComponentRegistry` class — the registry was decorative; `runtime-block-render.ts`'s switch was authoritative. Replaced internally with a `FOCUSABLE_TYPES` set.
- `ApiServer`, `setApiBaseUrl`, `FileRouter` — internal classes that should never have been part of the public surface.
- `dynamic(deps, render)` overload — `deps` was stored but never read. Single-arg API only.

### Changed

- **Test runner**: `test/run-all.ts` now globs `test-*.ts` and `**/*.test.ts` instead of an allowlist of 10 files. Default suite went from 1,469 to 2,127 passing assertions across 25 suites. `--stress`, `--demos`, and `--all` flags opt into the slower suites.
- **`terminaltui serve` single-file path removed** — `startSingleFileSession` deleted; running `serve` on a non-file-based project prints a clear error pointing at `terminaltui init`.
- **`compileFile` skips esbuild bundling under tsx/ts-node** — projects whose pages import the framework via relative paths no longer trip on native binaries (`ssh2`'s `.node` files). Bundle path also externalizes relative `src/index.js` imports for the rare projects that compile production builds.
- **`compileFile` cache key is sha1 of absolute path** instead of last-80-char tail. Eliminates the (theoretical) collision when two deeply nested projects share a path tail.
- **`box-model` is closer to the single source of truth it claimed to be** — `flex-engine.estimateBlockHeight` (card branch) now derives chrome from `COMPONENT_DEFAULTS`; `components/layout/Panel.ts` uses `computeBoxDimensions` instead of inline arithmetic with mislabeled variable names.

### Security hardening

- `exec` / `execSync` → `spawn` / `spawnSync` with array args in `helpers/open-url.ts`, `helpers/clipboard.ts`, and `core/ssh-server.ts` (host-key generation). No shell interpolation.
- `terminaltui art create <type> <name>` validates `name` against `/^[a-z0-9][a-z0-9_-]*$/i` (path-traversal guard).
- `api/server.ts` caps request bodies at 1 MB.

### Notes

- SSH `serve` keeps its allow-all default; password auth remains opt-in via `auth.passwords`.
- `ARCHITECTURE.md` rewritten to match the post-1.6.0 reality (removed `routing/` section, dropped `runSite` references, fixed the dependency graph, documented `runtime-context`).

### Removed dead files (no behavior change)

`src/core/renderer.ts` (Cell-diff renderer, 0 importers), `src/layout/engine.ts`, `src/layout/constraints.ts`, `src/ascii/fonts-extra.ts`, `src/cli/init-templates.ts`, `src/components/registry.ts`. Plus the matching test cleanup (5 stress harnesses + 9 directory-based tests + 3 manual harnesses, all of which targeted the single-file API removed in 1.6.0).

---

## [1.6.1] - 2026-04-28

### Fixed

- **`terminaltui init` now scaffolds the file-based shape** — every template was still emitting the pre-1.6.0 layout (`site.config.ts` with a `pages: [...]` array) using removed exports `defineSite`/`page`, plus `banner: ascii(...)` (a content block, not a banner spec). Running `npm run dev` on a fresh project failed immediately with `No config.ts found alongside a pages/ directory`. All six templates (minimal, portfolio, landing, restaurant, blog, creative) now emit `config.ts` with `defineConfig({...})` + `pages/<name>.ts` files exporting `metadata` and a default render function, matching the demo layout.
- **Typo'd template/theme names no longer fall back silently** — `init` now prints `'X' is not a known template — using 'minimal'` instead of accepting any string and quietly defaulting.

---

## [1.6.0] - 2026-04-28

### Removed (breaking)

- **Single-file `site.config.ts` mode** — `defineSite()`, `page()`, `route()`, `runSite()`, and the `terminaltui migrate` command are gone. The framework is now file-based only (`config.ts` + `pages/` + optional `api/`).
- **Layout `split()` and `box()`** — `split()` was redundant with `columns([panel, panel])`; `box()` was redundant with `panel({border, padding, content})`. Use the explicit forms.
- **Animation transitions** — `transition.ts`, `typing.ts`, `stagger.ts`, `fade.ts`, `effects.ts` (matrix rain / glitch / sparkle) deleted. The `transitions` field on `AnimationConfig` is gone. `boot` and `exitMessage` survive; spinner/engine survive.
- **ASCII community-pack public API** — `registerArtPack`, `useArtPack`, `listArt`, `getArtInfo`, `createArtPack`, `registerFont/Scene/Icon/Pattern` no longer exported. The internal art registry stays as plumbing for built-in assets.
- **`artCompose`** (overlay/mirror/rotate/colorize/shadow on string[] art) — niche, not used by demos. Gone.
- **`brailleSparkline`, `dotMatrix`, `braillePattern`** — exotic, deleted. Use `asciiArt.sparkline()` for sparklines.
- **Tetris demo** — broken since 1.0.5; removed (folder + gif + README reference).
- **`PanelFocusManager`** dead code (deprecated since 1.0.5).
- **`runPreview` CLI stub** — never implemented; deleted.
- **`src/routing/`** folder — `navigate()` moved into `src/router/`; route/middleware types moved to `router/types.ts` and `middleware/types.ts`.

### Changed

- Demo bundling dropped — demo sources ship in the npm package under `demos/<name>/` (config.ts + pages/) and are compiled on the fly by `npx terminaltui demo <name>`. No more `dist/demos/*.js` artifacts.
- Renamed `src/components/Box.ts` is unchanged (it's the rendering utility used by Card/Form/etc., not the deleted layout `box()`).
- `terminaltui dev` now requires `config.ts + pages/`; running it on a `site.config.ts` errors clearly instead of going through the deprecated path.

### Migration from 1.5.x

If you were using `defineSite`/`page`/`route`/`split`/`box`:
- Convert your project layout to `config.ts` + `pages/` (one file per page).
- Replace `split({direction: "horizontal", ratio: 30, first, second})` with `columns([panel({width: "30%", content: first}), panel({width: "70%", content: second})])`. Vertical splits become `rows(...)` with `height` instead of `width`.
- Replace `box({content, border, padding})` with `panel({content, border, padding})` (no title/scroll) or `container({content, padding})` (centered).

---

## [1.5.1] - 2026-04-10

### Fixed

- **SSH color mode detects client TERM** — reads `term` from the SSH pty request (e.g. `xterm-kitty` → truecolor, `xterm-256color` → 256, `vt100` → 16) instead of hardcoding 256 for all SSH sessions
- **openUrl() is a no-op in serve mode** — displays the URL as a notification instead of executing shell commands (`open`/`xdg-open`) on the server. Configurable via `serve.openUrls: true` in site config
- **Color mode is per-runtime** — each SSH session maintains its own color mode. Multi-user sessions no longer clobber each other's colors via the global singleton
- **Reset before erase-line prevents color bleed** — prepends `\x1b[0m` before each `\x1b[2K` so a missed reset on one line can't flood subsequent lines with background color
- **Easter egg functions disabled in serve mode** — function-valued easter egg commands are skipped over SSH to prevent unintended server-side execution
- **Primary button focus style is subtler** — focused primary buttons use bold border + bold accent text instead of a solid background fill that dominated the page

### Added

- **`serve` config in SiteConfig** — configure SSH hosting from `defineSite()` or `defineConfig()`: `port`, `hostKeyPath`, `maxConnections`, `colorMode`, `openUrls`, `auth`
- **`termType` on TerminalIO interface** — exposes the client's TERM string for color capability detection
- **`isServeMode` getter on TUIRuntime** — indicates whether the runtime is serving over SSH

---

## [1.5.0] - 2026-04-10

### Added

- **SSH Hosting (`terminaltui serve`)** — host any TUI app over SSH so users connect with `ssh host -p PORT`, zero install required. Each connection gets an independent session with full interactivity (navigation, forms, resize).
  - `--port <N>` flag (default: 2222)
  - `--host-key <path>` flag (auto-generates Ed25519 key on first run)
  - `--max-connections <N>` flag (default: 100)
  - Per-session `TerminalIO` abstraction — SSH channel used as I/O target
  - Session logging (connect/disconnect with client IP and active count)
- **`TerminalIO` interface** — abstracts terminal I/O away from `process.stdin`/`process.stdout`, enabling pluggable I/O targets (SSH channels, PTYs, custom streams)
- **`ProcessTerminalIO`** — default implementation wrapping `process.stdin`/`process.stdout` for local `dev` usage
- **`SSHServer` and `ServeOptions` exports** — programmatic API for embedding SSH hosting in custom setups

### Changed

- **`TUIRuntime` accepts optional `TerminalIO`** — constructor now takes an optional second argument for custom I/O. Defaults to `ProcessTerminalIO` for full backward compatibility.
- **`InputManager` and `Screen` use `TerminalIO`** — no longer hardcoded to `process.stdin`/`process.stdout`. Both accept a `TerminalIO` via `attachIO()`.
- **`writeToTerminal` uses `\r\n`** — fixes rendering over SSH where raw `\n` doesn't return cursor to column 1
- **SSH sessions use 256-color mode** — since the server can't detect the remote client's terminal capabilities, SSH sessions default to 256-color (safe for all terminals)
- **Process signals scoped to local sessions** — `SIGINT`/`SIGTERM` handlers and `process.exit()` only attach for `ProcessTerminalIO`, preventing a single SSH disconnect from killing the server
- **`ssh2` added as optional dependency** — only required for `terminaltui serve`. The `dev` command works without it.

---

## [1.4.0] - 2026-04-09

### Fixed

- **Single-file build produces functional bundles** — `terminaltui build` on `site.config.ts` now wraps the entry with `runSite()` so the published npm package actually starts the TUI (#1)
- **File-based routing build uses relative paths** — `_entry.ts` no longer hardcodes absolute filesystem paths; all imports are relative and resolved at bundle time (#2)
- **`compileFile()` throws clear errors** — when esbuild is unavailable outside dev mode, a descriptive error is thrown instead of silently returning a raw `.ts` path that Node.js can't import (#3)
- **`_entry.ts` cleaned up after build** — intermediate build artifacts are deleted from `dist/` after successful bundling, preventing them from being published to npm (#5)

### Added

- **`text()` content helper** — `import { text } from "terminaltui"` creates a plain text content block. Previously referenced in docs but not exported (#4)
- **Build validation** — after bundling, the build checks that the output contains a `runSite()` call and warns about any hardcoded absolute paths (#7)
- **Page Visibility documentation** — clear docs on how to hide pages from menus in both single-file and file-based routing modes (#8)
- **Banner config clarification** — docs now show both `ascii()` helper and plain object forms for the `banner` field (#9)

### Changed

- **Version jump from 1.0.9 to 1.4.0** — versions 1.1.0 through 1.3.0 were experimental publishes from a separate codebase and have been deprecated on npm. This release continues from the stable 1.0.x line (#6)

### Deprecated

- **npm versions 1.1.0–1.3.0** — these were experimental/incompatible releases. Use 1.4.0+ instead.

---

## [1.0.5] - 2026-03-26

### Added

- **Spatial Navigation Engine** — arrow keys now move to the nearest focusable item by screen position (like a TV remote / Android TV D-pad), replacing the old panel-based Tab cycling
  - `findNextFocus()` algorithm scores candidates by distance + alignment (2x weight on axis alignment)
  - Direction-filtered: only items in the arrow direction are candidates
  - ← from leftmost position goes back; automatic for all layout functions
  - New `computeFocusPositions()` in flex-engine walks the entire content tree and assigns FocusRect screen coordinates to every focusable item

- **12-Column Responsive Grid System** — Bootstrap-style layout primitives
  - `container(content, { maxWidth, padding, center })` — centered content wrapper
  - `row(cols, { gap })` — 12-column grid row with responsive column wrapping
  - `col(content, { span, offset, xs, sm, md, lg })` — grid column with breakpoint-aware spans
  - Responsive breakpoints: xs (<60 cols), sm (60-89), md (90-119), lg (≥120)
  - Rows auto-wrap when effective spans exceed 12 at the current breakpoint
  - Nesting support — rows inside cols inside rows

- **Unified Box Model** — single source of truth for component width calculation
  - `computeBoxDimensions(allocatedWidth, { border, padding, margin })` — every component calls this
  - `COMPONENT_DEFAULTS` — centralized padding/border/margin defaults for all 28+ components
  - Zero manual `width - N` math remaining in any component file

- **File-Based Routing** — Next.js App Router-style directory-based page routing
  - `config.ts` + `pages/` directory structure replaces single `site.config.ts` for larger projects
  - Page files: `export default function About() { return [...] }` with optional `export const metadata`
  - Layout files: `pages/layout.ts` wraps siblings/descendants, receives `{ children }`
  - Nested layouts compose from outside in (root → section → page)
  - Dynamic routes: `pages/projects/[slug].ts` receives `{ params: { slug } }`
  - Async pages: `export default async function Dashboard() { ... }`
  - File-based API routes: `api/stats.ts` exports `GET()`, `POST()`, etc.
  - Auto-generated menu from filesystem (ordering via `metadata.order`, labels via `metadata.label`)
  - Manual menu override in `defineConfig({ menu: { items: [...] } })`
  - New `menu({ source: "auto" })` component for inline auto-menu rendering
  - `MenuBlock` content type added to the block union
  - `FileRouter` class: scanner → route table → menu builder → page loader → layout chain
  - 9 router module files: types, scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, index

- **`terminaltui migrate`** CLI command — converts existing `site.config.ts` to file-based routing structure (config.ts + pages/ + api/)

- **`defineConfig()` overload** — now accepts file-based routing config (`{ name, theme, menu, ... }`) in addition to the existing env-var schema

- **9 demos migrated to file-based routing** — each demo now has both `site.config.ts` (backward compat) and `config.ts` + `pages/` (new structure)

- **169 new router unit tests** across 8 test files (scanner, route-table, menu-builder, page-loader, layout-chain, api-loader, resolver, migrate) plus 1 integration test

- **204 demo navigation tests** — emulator-based tests for all 9 demos

- **103 box model tests** and **41 grid system tests**

### Changed

- **All 9 demos rebuilt with spatial layouts** — split, grid, row/col, container patterns throughout
  - developer-portfolio: row/col grid for skills, container for centered content
  - restaurant: tabs for menu, split for contact form, row/col for menu items
  - startup: row/col for features and pricing, accordion for quickstart
  - band: row/col for discography and press quotes, container for about
  - coffee-shop: tabs for menu, row/col for beans and hours
  - conference: tabs for schedule, row/col for speakers and sponsors
  - freelancer: row/col for services, work portfolio, and testimonials
  - dashboard: row/col for stat cards, split for posts
  - server-dashboard: row/col for resource cards, split for system info

- **Navigation model** — spatial navigation replaces Tab-based panel cycling on all layout pages; Tab still works as sequential fallback
  - ↑↓/jk move to nearest item above/below by screen position
  - ←→/hl move to nearest item left/right; ← from leftmost goes back

- **CLI `dev` command** auto-detects project type: file-based (`config.ts` + `pages/`) vs single-file (`site.config.ts`)

- **CLI `findConfig()`** now checks for `config.ts` + `pages/` before falling back to `site.config.ts`

### Fixed

- Card height equalization causing excessive whitespace in side-by-side layouts
- Border clipping at very narrow terminal widths (<10 cols)
- Search input dropdown filling entire viewport
- Focus prefix overflow causing content to exceed terminal width
- Percentage column overflow in layoutColumns
- Button ignoring ctx.width (labels now truncate to fit)
- Section/accordion/timeline content overflow beyond allocated width
- Responsive row wrapping not honoring breakpoints
- Emulator resize not triggering app re-render (SIGWINCH forwarding)
- Table cells missing right-padding in truncation

### Removed

- `PanelFocusManager` — no longer imported or used (file still exists as dead code); superseded by spatial navigation

### Breaking Changes

- **Navigation behavior change**: Arrow keys on layout pages now use spatial navigation instead of panel-based Tab cycling. The `panelArrows` config option still exists but has no effect. Users who relied on Tab to switch panels can still use Tab (sequential fallback), but arrow keys now move spatially.

## [1.0.4] - 2026-03-24

### Changed
- Modularized codebase: split runtime into runtime-input, runtime-pages, runtime-render, runtime-block-render, runtime-forms
- Lazy-load fonts (reduced startup time)
- Updated docs: component registry, fixed npm import paths, added ARCHITECTURE.md references

## [1.0.3] - 2026-03-24

### Added
- `terminaltui demo` command — run 8 built-in demos from npm
- Server dashboard demo with nested layouts

### Changed
- Rebuilt all 8 demos with split-pane layouts (columns, rows, split, grid)

## [1.0.2] - 2026-03-24

### Added
- Split-pane layouts: `columns()`, `rows()`, `split()`, `grid()`, `panel()`
- Panel focus management (Tab/Shift+Tab between panels)
- Active panel border indicator
- Responsive collapse for narrow terminals

## [1.0.1] - 2026-03-23

### Fixed
- 8 bugs found during full framework verification (P0-P3)
- Menu navigation now enforces middleware
- Lifecycle hooks fire on menu navigation
- Route function titles resolve correctly
- `computed()` auto-invalidates
- `section()` gives clear error on wrong args
- Viewport scrolls past last focusable item
- Emulator `goHome()` and `navigateTo()` fixes

## [1.0.0] - 2026-03-22

### Added
- Initial release: 21+ content blocks, 10 themes, ASCII art system, state management, data fetching, routing, middleware, API routes, forms, CLI, emulator, Claude integration
