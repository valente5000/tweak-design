# tweak-design playground

Local design review playground. Loads HTML layouts in iframes, lets you tweak CSS variables live, drop annotations, and export structured feedback as a markdown prompt.

## Quick start

```bash
# from inside this directory
python server.py
```

Browser opens automatically at <http://127.0.0.1:7860/playground/playground.html>.

## What it expects

A sibling `layouts.json` in the same directory, listing the HTML files to review:

```json
{
  "title": "My deck review",
  "layouts": [
    {"id": "01-cover", "label": "Cover", "src": "../slides/01-cover.html"}
  ],
  "tweaks_manifest": "./tweaks.json"
}
```

`src` paths are relative to the **project root** (the parent of this `playground/` directory).

`tweaks.json` is optional — if absent, the playground auto-detects CSS custom properties from the loaded HTML and renders generic controls.

## Display modes

The playground auto-detects the right rendering mode for each loaded layout by inspecting its natural dimensions after fonts settle:

- **Slide mode** (default for short/wide layouts) — the iframe is locked at 1920×1080 and aspect-fit-scaled into the pane; intended for `huashu-design`-style decks
- **Page mode** (auto-triggered when content height/width > 1.05 OR height > 1300px) — wrap grows to the page's actual `scrollHeight`; pane scales horizontally only and scrolls vertically; intended for full-page websites, blog posts, dashboards

You don't toggle this manually — the detection happens once on iframe load. If you want to force one mode, edit `applyDisplayMode()` in `playground.js`.

## Persistence

Tweaks, annotations and view state auto-save to `localStorage` on every change. The storage key is **content-addressed** — derived from a hash of the loaded `layouts[]` (id + src) — so:

- **Same project, refresh** → state restored (the intended persistence)
- **Different project (different layouts)** → fresh start; the new project never inherits stale state from a prior project, even when both run at `http://127.0.0.1:7860/playground/playground.html`

If you ever need to force a clean slate for the current content, run `localStorage.clear()` in the playground tab's devtools console.

## Keyboard shortcuts

- `1` / `2` / `3` — switch view mode (single / 2-up / 3-up)
- `←` / `→` — switch layout in single mode
- `e` — open export modal
- `Esc` — close modal / cancel annotation drag

## Files

- `playground.html` — UI shell
- `playground.css` — styles (dark theme, yellow accent)
- `playground.js` — all logic
- `server.py` — minimal Python server with CORS
- `_example/` — sample manifests + demo layouts to self-test

## Self-test

```bash
# from this directory
cd _example
python ../server.py
```

Loads two demo HTMLs (`demo-a.html`, `demo-b.html`) with a sample tweaks manifest. Use it to verify your install before pointing at real work.
