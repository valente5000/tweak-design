# demo-source — render the README walkthrough

This is the source of [`../demo.mp4`](../demo.mp4): a 1:02 cinematic walkthrough that combines real playground screenshots (`shots/`) with animated overlays (cursor moves, modals, captions in a letterbox bar) authored as React + Babel scenes.

## Layout

```
demo-source/
├── index.html             # entry: loads React 18 + Babel-standalone via CDN, mounts <Stage>
├── animations.jsx         # Stage / Sprite / easing primitives + playback bar
├── scenes/
│   ├── common.jsx         # CaptionBar, Cursor, Camera, Vignette, color tokens
│   ├── scene1-open.jsx    # 0–4s   — terminal: npx skills add valente5000/tweak-design
│   ├── scene2-hero.jsx    # 4–11s  — three layouts side by side ("Three directions. One playground.")
│   ├── scene3-tweak.jsx   # 11–18s — accent color picker → 3 layouts react
│   ├── scene4-focus.jsx   # 18–25s — tab click → focus mode on one layout
│   ├── scene5-annotate.jsx# 25–34s — pin + quadrant + auto-highlighted DOM
│   ├── scene6-export.jsx  # 34–44s — Export modal → "Copied to clipboard" toast
│   ├── scene7-claude.jsx  # 44–52s — Claude Code applying the diff
│   └── scene8-end.jsx     # 52–62s — wordmark + tagline + install hint
└── shots/                 # screenshots, WebP-compressed (originals were 24 MB PNG)
```

The full timeline is **62s @ 1920×1080**. Stage's `autoplay` + `loop` flags mean it plays as soon as the page mounts.

## View it locally

```bash
cd assets/demo-source
python3 -m http.server 7861
open http://localhost:7861/index.html   # or visit in any browser
```

`localStorage` persists the playhead between reloads — clear with `localStorage.clear()` in DevTools to restart.

## Re-render the MP4

The committed `../demo.mp4` was rendered headlessly with **Playwright + ffmpeg**. To re-render after editing scenes:

```bash
# Prereqs (one-time)
npm install playwright
npx playwright install chromium
brew install ffmpeg                      # if missing

# 1. Serve the bundle
cd assets/demo-source
python3 -m http.server 7861 &

# 2. Record (writes raw.webm)
node <<'JS'
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.resolve('out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1124 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1124 } },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__appReady = false;
    setInterval(() => {
      const r = document.getElementById('root');
      if (r && r.firstChild && r.firstChild.firstChild) window.__appReady = true;
    }, 50);
  });
  await page.goto('http://localhost:7861/index.html');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(63000);
  await ctx.close(); await browser.close();
})();
JS

# 3. Trim 0.5s from the start (Babel mount), take 62s, crop the playback bar,
#    scale to 720p, encode H.264 with +faststart for streaming.
ffmpeg -y -i out/*.webm -ss 0.5 -t 62 \
  -filter:v "crop=1920:1080:0:0,scale=1280:720:flags=lanczos" \
  -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an ../demo.mp4

# 4. Refresh the poster
ffmpeg -y -ss 7 -i ../demo.mp4 -vframes 1 -q:v 4 ../demo-poster.jpg
```

## Why viewport `1920×1124` and not `1920×1080`

The Stage component reserves 44 px at the bottom for the playback scrubber (`PlaybackBar`). Running the page at exactly 1080 px tall scales the canvas down to fit. Recording at 1124 px keeps the canvas at 1:1 with the viewport, then ffmpeg crops the scrubber off the bottom (`crop=1920:1080:0:0`). Pixel-perfect output, no scaling artifacts.

## Provenance

Authored via [Claude Design](https://claude.ai/design). The source bundle handed off includes raw screenshots, scene files, and the chat transcript that drove the storyboard. The screenshots were converted from PNG → WebP (q=82) for repo footprint — visual fidelity is preserved since these are mostly UI flat colors and crisp text.
