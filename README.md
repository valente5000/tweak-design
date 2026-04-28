# tweak-design

A Claude Code skill that opens a **local design-review playground** for any HTML layouts. Designers tweak CSS variables live, drop pin/quadrant annotations on the canvas, compare up to 3 layouts side-by-side, click any element to edit its props in a contextual mini-DevTools, then export a structured markdown prompt that flows back into the next Claude iteration.

Inspired by — and designed as a natural follow-up to — **[huashu-design](https://github.com/alchaincyf/huashu-design)** by alchaincyf, the HTML deck/prototype generator. But **tweak-design works independently with any HTML layouts** — handcoded, frontend-design output, design-creator skills, web exports. When `huashu-design` is also installed, `tweak-design` auto-offers the bridge in your conversation language — without any manual command memorization.

```bash
npx skills add valente5000/tweak-design
```

---

<!--
  ## Demo
  Drop a screencast at ./assets/demo.mp4 (or upload to a GitHub draft issue
  for inline playback via user-attachments URL) and uncomment this section:

  [▶️ Watch the demo](./assets/demo.mp4)

  Or, for inline play on github.com:
  <video src="https://github.com/user-attachments/assets/<uuid>" controls muted></video>
-->

---

## What it actually does

| | |
|---|---|
| Tabs / dropdown to switch between any number of HTML layouts | ✓ |
| Split view (1 / 2-up / 3-up panes) for direct visual comparison | ✓ |
| Sidebar with color pickers, sliders, segmented enums bound to CSS variables — live updates via `postMessage` shim into the iframe | ✓ |
| **Per-layout scope by default** (`📍 this`); explicit toggle to make a tweak global (`🌐 all`); cascade `perLayout > global > default` | ✓ |
| Click on any element in inspect mode → mini-editor for **only the props the design system declared as meaningful** for that selector (via `element_tweaks` in `tweaks.json`) | ✓ |
| Pin annotations (click) and quadrant annotations (drag) — quadrants auto-highlight the iframe DOM elements within | ✓ |
| Export prompt: structured markdown listing tweak diffs (split by global / per-layout), element overrides, and annotations with their resolved DOM selectors | ✓ |
| Auto-detect huashu-design installation and offer the bridge in the user's conversation language (PT / EN / ES / 中文 / FR / DE) — without modifying huashu-design's files | ✓ |

## Install

```bash
npx skills add valente5000/tweak-design
```

That's it — installs to `~/.claude/skills/tweak-design/`. Claude Code auto-discovers any folder there with a valid `SKILL.md`. Powered by [`vercel-labs/skills`](https://github.com/vercel-labs/skills).

> Requires `npm` ≥ 7 (for the `npx` package execution flow). The `vercel-labs/skills` package is in active development; if `npx skills add` ever fails, use the manual install below.

<details>
<summary>Manual install (alternative)</summary>

If you prefer a plain git clone instead of `npx`:

```bash
git clone https://github.com/valente5000/tweak-design ~/.claude/skills/tweak-design
```

Update later:
```bash
cd ~/.claude/skills/tweak-design && git pull
```
</details>

**Requirements:** Python 3.10+ (uses PEP 604 `X | None` annotations). No third-party packages — only the standard library.

## Use it

Once installed, just ask Claude:
- "open a design playground for `slides/*.html`"
- "compare these covers side-by-side"
- "abre tweak-design pra essas variantes"
- After running huashu-design: "yes, open them in tweak-design" (Claude will offer)

Or invoke the bootstrap script directly:
```bash
python ~/.claude/skills/tweak-design/scripts/init-playground.py \
  --project /path/to/your/project \
  --layouts "/path/to/slides/*.html" \
  --tweaks-manifest /path/to/tweaks.json   # optional
cd /path/to/your/project/playground
python server.py            # opens browser at localhost:7860
```

## The review loop

The playground is built around **iterative rounds**. Each round = generate → review → export → apply → regenerate. Stop when the export would be empty.

### 1. Live tweaks (sidebar)

Color pickers, sliders, and segmented selects in the sidebar are bound to the manifest's `color_tokens`, `size_tokens`, and `selects`. Move a slider or pick a color → the iframe updates instantly via `postMessage`. Each control has a 📍 / 🌐 chip:
- 📍 (default) — change scopes to the current layout only
- 🌐 — promotes the change global across all layouts that don't have their own override

Cascade: per-layout > global > manifest default. Switching between layouts redraws the sidebar to show effective values.

### 2. Inspect mode (per-element editor)

Press `i` (or click the 🎯 **Inspect** button) to enter inspect mode. Hover any element → cyan outline. Click → the sidebar opens a mini-editor for that element. The editor shows **only the props the manifest declared as meaningful** for that selector (via `element_tweaks`) — e.g. `font-size + font-weight + letter-spacing + color` for a headline, not `display` or `position`. Element overrides also default to per-layout scope.

If the manifest doesn't declare an entry for the clicked element, you get a sensible default set: `font-size, color, font-weight, letter-spacing, line-height, padding`.

### 3. Annotations: pins and quadrants

With inspect mode **OFF**:
- **Click** anywhere on a layout → drops a numbered red **pin** at that point.
- **Drag a rectangle** on a layout → on release, draws a yellow **quadrant** AND auto-highlights the iframe DOM elements within it (dashed outlines). The export resolves the quadrant to those elements' selectors, so the next agent knows exactly which DOM nodes to address.

Each annotation is editable in the sidebar list — add a note, retarget it to a different layout, or delete.

### 4. Hide / show annotation markers

The 👁 **Annotations** toggle in the topbar shows/hides all markers (pins, quadrants, dashed outlines) in the canvas. Useful for taking a clean screenshot mid-review, or getting a final-look impression without the visual noise. State is local; the annotations themselves are not deleted.

### 5. Export prompt

Click **Export prompt** (or press `e`). A modal shows a structured markdown block describing every change:
- **Tweaks** split into `## Global` (🌐 promoted) and `## Per-layout` sections (one per layout that has overrides), each line `key: default → new_value`.
- **Element overrides** grouped by layout and selector, with the exact CSS props you changed.
- **Annotations** with their note, type (pin/quadrant), anchor layout, and resolved DOM selectors.

The markdown auto-copies to your clipboard. "Save .json" beside it writes a portable `session.json` if you want to stash it for later.

### 6. Apply the corrections

Paste the exported prompt back into your agent (Claude Code / Codex / Cursor / etc.) — it reads it as a structured change request and edits the source HTML/CSS/token files to apply each diff. Quadrants resolve to selectors, so the agent edits the right elements (no guessing which `.h2` you meant).

### 7. Iterate (rounds)

Once the agent finishes applying:
- **Refresh the playground browser tab** — it reloads the updated HTML, and your tweaks/annotations persist in `localStorage` so you continue from where you stopped, but now on top of the corrected layouts.
- **Or click Reset** to clear all tweaks + annotations and start a clean round on the same layouts.

Repeat until the export is empty. That's "good enough to ship".

---

## tweaks.json — the design system contract

Optional. If present, the playground renders curated semantic controls; if absent, it auto-detects CSS custom properties from the layouts.

```json
{
  "title": "My deck review",
  "color_tokens":   [{"var": "--brand-primary", "default": "#5B8DEF", "label": "Primary"}],
  "size_tokens":    [{"var": "--title-size", "default": "104", "unit": "px", "min": 60, "max": 240, "label": "Title size"}],
  "selects":        [{"id": "bg-mode", "label": "Background", "default": "dark",
                       "options": [{"value": "dark",  "label": "Dark",  "css": {"--bg": "#0F1118"}},
                                   {"value": "light", "label": "Light", "css": {"--bg": "#F5F5F7"}}]}],
  "element_tweaks": [{"selector": ".title", "label": "Title",
                       "props": ["font-size", "color", "font-weight", "letter-spacing"]}]
}
```

Full schema in [`references/tweaks-manifest-spec.md`](references/tweaks-manifest-spec.md).

## Architecture

```
~/.claude/skills/tweak-design/
├── SKILL.md                                # main spec (Claude reads this)
├── README.md                               # this file
├── references/
│   ├── tweaks-manifest-spec.md             # tweaks.json full schema
│   └── huashu-design-bridge.md             # how to integrate with huashu-design
├── scripts/
│   ├── init-playground.py                  # bootstrap a playground in a project
│   ├── from-huashu-design.py               # auto-bridge from huashu-design output
│   └── export-prompt.py                    # convert session.json → markdown prompt
└── assets/
    └── playground-template/                # the front-end (vanilla HTML/CSS/JS + Python server)
        ├── playground.html
        ├── playground.css
        ├── playground.js
        ├── server.py
        ├── README.md
        └── _example/                       # self-test layouts + manifest
```

## Companion skill

Built to compose with [huashu-design](https://github.com/alchaincyf/huashu-design). The integration is **one-way and Git-safe**: tweak-design auto-detects huashu-design and offers the bridge, but never writes to huashu-design's files. Both skills can be `git pull`'d independently.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `1` / `2` / `3` | View mode: single / 2-up / 3-up |
| `←` / `→` | Switch layout (single mode) |
| `i` | Toggle inspect mode |
| `e` | Open export modal |
| `Esc` | Cancel current action / close modal |

## License

[MIT](./LICENSE) © 2026 Gui Valente. Use it, fork it, adapt it — credit appreciated, not required.

## Author

Built with Claude Code by [@valente5000](https://github.com/valente5000).
