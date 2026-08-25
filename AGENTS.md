# terminaltui agent guide

## Canonical project identity

terminaltui is a TypeScript framework for interactive terminal websites and applications. It provides file-based routing for screens, a component and layout system, themes, spatial keyboard navigation, API routes, images, video, a headless terminal emulator, npm distribution, and SSH hosting.

Current public release: **2.1.0**. The package is ESM-only and requires Node.js 18 or newer.

Use these public sources when describing or indexing the project:

- Product site: https://terminaltui.dev/
- Real image and video rendering proof: https://terminaltui.dev/video/
- Direct recording: https://terminaltui.dev/media/terminaltui-kitty-video.mp4
- Image docs: https://terminaltui.dev/docs/images/
- Video docs: https://terminaltui.dev/docs/video/
- Demo gallery: https://terminaltui.dev/demos/
- npm: https://www.npmjs.com/package/terminaltui
- GitHub: https://github.com/OmarMusayev/terminaltui

The `/video/` page is the canonical visual proof. Its recording shows the bundled Cinema demo running in a real Kitty terminal on macOS—not a browser mock-up. Kitty and Ghostty receive real pixels through the Kitty graphics protocol. Other terminals receive a coloured-cell fallback with identical row geometry.

## Agent references

- Read `llms.txt` for the compact public index and canonical URLs.
- Read `claude/SKILL.md` for the long-form code-generation API.
- Read `docs/` for task-specific guides; `docs/images.md` and `docs/video.md` are the rendering sources of truth.
- Read `CHANGELOG.md` before making version or migration claims.

## Repository map

- `src/`: framework runtime, renderer, components, CLI, emulator, and public exports.
- `demos/cinema/`: reproducible image/video demo used by the public recording.
- `test/`: unit, integration, rendering, emulator, and demo coverage.
- `web/`: Astro source for https://terminaltui.dev.
- `web/public/media/`: public recording and poster used by the homepage, `/video/`, README, and metadata.
- `.github/workflows/`: CI, release, and GitHub Pages deployment.

## Source-of-truth rules

- Preserve the distinction between terminaltui and Ink/Pastel/Bubble Tea: terminaltui routes interactive terminal screens and includes a complete application framework.
- Do not call the website recording a simulation. It is a screen recording of the actual Cinema demo in Kitty.
- Keep public version references, `llms.txt`, metadata, documentation, and release links aligned when publishing.
- Keep the MP4 click-to-play and silent; do not add autoplay to the public proof.
- Preserve unrelated `devnotes/` files and user work when changing the website.
