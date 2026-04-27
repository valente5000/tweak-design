# `tweaks.json` schema

The `tweaks.json` file declares what controls appear in the playground sidebar. It's optional — without it, the playground auto-detects CSS custom properties from the loaded layouts and renders generic controls. With it, you get labeled, semantic, grouped controls.

## Top-level structure

```json
{
  "title": "string (optional, shown in playground header)",
  "color_tokens":   [ColorToken,   ...],
  "size_tokens":    [SizeToken,    ...],
  "selects":        [Select,       ...],
  "element_tweaks": [ElementTweak, ...],
  "groups":         [Group,        ...]
}
```

All five list fields are optional. An empty manifest (`{}`) is valid — the playground falls back to auto-detection.

## Scoping model (v2)

All controls (token sliders, selects, AND element-level overrides) are **per-layout by default**. The user explicitly promotes a value to "global" via the 📍/🌐 chip on each control. This is the only behavior model:

- Per-layout (📍, default) — value applies only when this layout is in focus
- Global (🌐) — value applies to all layouts that don't have a per-layout override

Resolution cascade (CSS-style): `perLayout > global > manifest default`.

Controls show inheritance state visually: a value coming from global has a small 🌐 hint; a value differing from the global gets a "↺ reset to global" affordance instead of "↺ reset to default".

## ColorToken

A CSS color variable that becomes a color picker + hex input in the sidebar.

```json
{
  "var": "--brave-yellow",            // required, the CSS custom property name
  "default": "#FFCC00",                // required, the canonical default
  "label": "Brave Yellow",             // required, human-readable label
  "applies_to": ["01-cover.html"],     // optional; if absent, applies globally to all layouts
  "group": "Brand colors",             // optional; for sidebar grouping
  "description": "Primary accent"      // optional tooltip text
}
```

Behavior in playground:
- Renders as: label + 32px swatch (color picker) + hex input
- Live updates: on change, posts `{type: 'tweak:apply', vars: {'--brave-yellow': '#FFD700'}}` to scope iframes
- Reset icon shown only when value differs from default

## SizeToken

A numeric CSS variable (with unit) that becomes a slider + numeric input.

```json
{
  "var": "--cover-title-size",
  "default": "104",         // required, numeric value as string (no unit)
  "unit": "px",              // required, unit appended on apply: "px", "em", "rem", "%", "deg", etc.
  "min": 60,                 // required
  "max": 240,                // required
  "step": 1,                 // optional, default 1
  "label": "Cover title size",
  "applies_to": [...],
  "group": "Typography"
}
```

Behavior:
- Renders as: label + range slider + numeric input + unit suffix
- Live updates: posts `{type: 'tweak:apply', vars: {'--cover-title-size': '120px'}}`

## Select

A multi-option control where each option maps to a set of CSS variable changes (or a CSS rule patch). Used for "either/or" design decisions like "background: navy or yellow?".

```json
{
  "id": "cover-bg",                   // required, unique identifier
  "label": "Cover background",
  "applies_to": ["01-cover.html"],     // optional
  "default": "navy",                   // required, must match one of options[].value
  "ui": "segmented",                   // optional: "segmented" (default) | "dropdown" | "radio"
  "options": [
    {
      "value": "navy",
      "label": "Navy",
      "css": {                         // CSS variables to apply when this option is active
        "--cover-bg": "#000040",
        "--cover-text": "white"
      },
      "preview_color": "#000040"        // optional; rendered as a color dot in the option button
    },
    {
      "value": "yellow",
      "label": "Yellow",
      "css": {
        "--cover-bg": "#FFCC00",
        "--cover-text": "#000040"
      },
      "preview_color": "#FFCC00"
    }
  ]
}
```

Behavior:
- Renders as segmented button group (default) or dropdown
- Selecting an option applies all CSS vars in that option's `css` block at once
- Reset returns to `default` value

### Advanced: rule-level patches

If a select option needs more than CSS variable changes (e.g., toggle a body class), use the `rule` field instead of (or alongside) `css`:

```json
{
  "value": "compact",
  "label": "Compact",
  "rule": "body { --gutter: 64px; } .cover__title { font-size: 80px; }"
}
```

## ElementTweak (v2)

Tells the inspector **which CSS properties make design sense to expose** when the user clicks on a specific element. Without this, the inspector falls back to a generic 6-prop default set, which works but isn't curated.

Think of it as the design system saying "for a slide title, the meaningful tweaks are font size, color, weight, and letter-spacing — not, say, margin or display, because those would break the layout".

```json
{
  "selector": ".cover__title",        // required, CSS selector that matches the element
  "label": "Cover title",              // required, shown in the inspector header
  "props": [                           // required, ordered list of CSS props to expose
    "font-size",
    "color",
    "font-weight",
    "letter-spacing"
  ],
  "applies_to": ["01-cover.html"]      // optional, restrict to specific layouts
}
```

### Supported props (auto-rendered with the right control type)

| Prop | Control | Notes |
|---|---|---|
| `font-size`, `line-height`, `letter-spacing`, `padding`, `margin`, `border-radius`, `gap`, `width`, `height` | slider + number | unit auto-detected from current value (defaults to `px`) |
| `color`, `background`, `background-color`, `border-color`, `outline-color` | color picker + hex input | |
| `font-weight` | segmented (300/400/500/600/700/800) | |
| `text-align` | segmented (left/center/right/justify) | |
| `text-transform` | segmented (none/uppercase/lowercase/capitalize) | |
| `font-style` | segmented (normal/italic) | |
| `opacity` | slider 0-1 | |
| `display` | segmented (block/flex/grid/inline-block/none) | use sparingly — can break layout |

For props not in this list, a plain text input is rendered (you can type any CSS value).

### Click resolution

When the user clicks on an element in inspect mode, the playground walks up the DOM tree and finds the **first ancestor** matching any `selector` in `element_tweaks`. That entry's `props` are shown. If nothing matches, fallback defaults `[font-size, color, font-weight, letter-spacing, line-height, padding]` are used.

This is what lets the design system shape the inspector — declare specific selectors for the things you care about, and unknowns degrade gracefully to a sensible minimum.

## Group

Optional grouping for sidebar organization. Without groups, controls are listed in source order.

```json
{
  "id": "brand",
  "label": "Brand",
  "order": 1,
  "collapsed": false
}
```

Then individual tokens reference the group by id via the `group` field.

## Loading order in playground

1. Fetch `tweaks.json`
2. For each control type (color_tokens → size_tokens → selects), render in order
3. Apply default values to all visible iframes via initial postMessage
4. Save initial state to localStorage as the "default snapshot" for diff calculations

## Diff calculation (used by Export prompt)

The export prompt only includes tweaks where `current_value !== default`. The diff is calculated against the manifest defaults, not against the layout's CSS file. This means:
- If the user opens the playground, changes nothing, and exports — the export shows "no tweaks changed"
- If they change `--brave-yellow` from #FFCC00 to #FFD700 — export shows that diff
- For selects: if `default: "navy"` and they switch to "yellow", export shows `cover-bg: navy → yellow`

## Auto-detection (no manifest)

If `tweaks.json` is absent or fetch fails, the playground:
1. Fetches the first layout HTML
2. Parses it for inline `<style>` blocks and any linked stylesheets (same-origin)
3. Extracts all `--var: value` declarations from `:root` (or `html`)
4. Heuristically classifies each:
   - Hex/rgb/hsl color → ColorToken
   - Numeric with unit (px/em/rem/%) → SizeToken
   - Other → ignored (no clean way to control via slider)
5. Renders unlabeled controls grouped under "Auto-detected"

This works for any HTML deck/prototype without prep, but a hand-written `tweaks.json` always produces a better UX.

## Example: full manifest for the Bravelabs covers

```json
{
  "title": "Bravelabs Cover · Variants",
  "color_tokens": [
    {"var": "--brave-navy",   "default": "#000040", "label": "Brave Navy",   "group": "brand"},
    {"var": "--brave-yellow", "default": "#FFCC00", "label": "Brave Yellow", "group": "brand"}
  ],
  "size_tokens": [
    {"var": "--gutter", "default": "120", "unit": "px", "min": 60, "max": 200, "label": "Page gutter", "group": "layout"}
  ],
  "selects": [
    {
      "id": "cover-direction",
      "label": "Cover direction",
      "default": "v1",
      "ui": "segmented",
      "options": [
        {"value": "v1", "label": "Bold Lab",     "preview_color": "#000040"},
        {"value": "v2", "label": "Editorial",    "preview_color": "#000040"},
        {"value": "v3", "label": "Yellow Flood", "preview_color": "#FFCC00"},
        {"value": "v4", "label": "Asymmetric",   "preview_color": "#F5F2EA"}
      ]
    }
  ],
  "groups": [
    {"id": "brand",  "label": "Brand",  "order": 1},
    {"id": "layout", "label": "Layout", "order": 2}
  ]
}
```
