# tweak-design

A Claude Code skill that opens a **local design-review playground** for any HTML layouts. Designers tweak CSS variables live, drop pin/quadrant annotations on the canvas, compare up to 3 layouts side-by-side, click any element to edit its props in a contextual mini-DevTools, then export a structured markdown prompt that flows back into the next Claude iteration.

Designed as the natural follow-up to **[huashu-design](https://github.com/alchaincyf/huashu-design)** (HTML deck/prototype generator). When huashu-design finishes producing layouts, tweak-design auto-offers to open them — in your conversation language — without any manual command memorization.

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

Clone into your Claude Code skills directory:

```bash
git clone https://github.com/valente5000/tweak-design ~/.claude/skills/tweak-design
```

Update later:
```bash
cd ~/.claude/skills/tweak-design && git pull
```

That's it — Claude Code auto-discovers any folder in `~/.claude/skills/` that contains a valid `SKILL.md`.

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

## tweaks.json — the design system contract

Optional. If present, the playground renders curated semantic controls; if absent, it auto-detects CSS custom properties from the layouts.

```json
{
  "title": "My deck review",
  "color_tokens":   [{"var": "--brand-primary", "default": "#000040", "label": "Primary"}],
  "size_tokens":    [{"var": "--cover-title-size", "default": "104", "unit": "px", "min": 60, "max": 240, "label": "Title size"}],
  "selects":        [{"id": "bg-mode", "label": "Background", "default": "navy",
                       "options": [{"value": "navy", "label": "Navy", "css": {"--bg": "#000040"}},
                                   {"value": "yellow", "label": "Yellow", "css": {"--bg": "#FFCC00"}}]}],
  "element_tweaks": [{"selector": ".cover__title", "label": "Cover title",
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

Personal use. No commercial redistribution without permission.

## Author

Built with Claude Code by [@valente5000](https://github.com/valente5000).
