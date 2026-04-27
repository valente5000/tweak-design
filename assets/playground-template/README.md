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
