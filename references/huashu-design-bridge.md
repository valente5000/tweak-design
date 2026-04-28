# Bridge: huashu-design → tweak-design

The huashu-design skill normally pauses to ask the user clarifying questions before/during generation. This bridge **inverts that flow**: huashu-design generates layouts using best-guess defaults, then exports its open questions as live controls in tweak-design. The user "answers by manipulating" rather than "answers by typing".

## Auto-detect & offer (the "v3 prompt")

The trigger lives in `tweak-design/SKILL.md` under "Auto-detect & offer the bridge after huashu-design". The short version: when Claude has just used huashu-design to produce ≥1 layout AND `~/.claude/skills/huashu-design/SKILL.md` exists, Claude proactively asks the user — in their conversation language — if they want to open the layouts in tweak-design.

### Phrasing examples (the language follows the user, not the SKILL.md)

| Lang | Prompt |
|---|---|
| pt-BR | "Acabei de gerar os layouts via huashu-design. Quero abrir o tweak-design pra você comparar lado-a-lado, ajustar tokens ao vivo e marcar o que mudar?" |
| en | "I just generated the layouts via huashu-design. Want me to open them in tweak-design so you can compare side-by-side, tweak tokens live, and mark what to change?" |
| es | "Acabo de generar los layouts con huashu-design. ¿Quieres que los abra en tweak-design para comparar lado a lado y marcar cambios?" |
| 中文 | "huashu-design 刚生成了几个 layout。要我用 tweak-design 打开它们吗？可以并排对比、实时调 tokens、标注要改的地方。" |
| fr | "Je viens de générer les layouts via huashu-design. Tu veux que je les ouvre dans tweak-design pour comparer côte à côte et marquer ce qui doit changer ?" |
| de | "Ich habe gerade die Layouts mit huashu-design erstellt. Soll ich sie in tweak-design öffnen, damit du sie nebeneinander vergleichen und Änderungen markieren kannst?" |

Match the user's tone too — if they've been formal, be formal; if they've been casual ("faz aí"), be casual ("abro o tweak-design pra você?").

### If accepted

Run the bridge:

```bash
python ~/.claude/skills/tweak-design/scripts/from-huashu-design.py \
  --project <project-root>
```

The script:
1. Finds layouts in `<project>/slides/*.html` or `<project>/layouts/*.html`
2. Reads `<project>/handoff.json` for project title (if present)
3. Reads `<project>/tweaks.json` if present (huashu-design wrote it directly), else derives one from `<project>/brand-spec.md` (extracting `--var: #hex` tables)
4. Calls `init-playground.py` to copy the playground template into `<project>/playground/`
5. Starts the local server on port 7860, auto-opens browser

**Git-safety guarantee**: this entire chain writes ONLY to:
- `<project>/playground/` (the user's project directory)
- `<project>/tweaks.json` (only if not already present and we derive one)

It NEVER writes to `~/.claude/skills/huashu-design/`. Both skills can be `git pull`'d independently without conflict.

### If declined

Drop the offer silently. Don't repeat in the same session. The user can always invoke it later by saying "abre no tweak-design" / "open in tweak-design".

---

## The original handoff.json contract (still supported)

## The conversion contract

For each clarifying question huashu-design would ask, it should emit one entry in `tweaks.json`. The mapping:

| Question shape | Becomes |
|---|---|
| "Is the cover background navy or yellow?" | `selects[]` entry with options navy + yellow + their CSS effects |
| "How big should the title be?" | `size_tokens[]` entry with min/max range bracketing the candidate sizes |
| "Which accent color — current brand yellow or a softer cream-yellow?" | `color_tokens[]` entry with `default` set to current brand value |
| "Which of these 3 layout directions do you prefer?" (the deepest case) | The 3 layouts are emitted as separate `layouts[]` entries, AND a `selects[]` entry "Layout direction" lets user toggle which one is showing |

## The huashu-design output contract for this bridge

When huashu-design wants to hand off to tweak-design, it writes to its project directory:

```
<project-root>/
├── slides/                    # the generated HTML layouts (always with default values)
│   ├── 01-cover.html
│   └── 02-content.html
├── tweaks.json                # NEW: the converted clarifying questions
└── handoff.json               # NEW: tells tweak-design how to bootstrap
```

The `handoff.json` looks like:

```json
{
  "from": "huashu-design",
  "version": "v1",
  "project_title": "Acme · Refined Template",
  "layouts": [
    {"id": "01-cover", "label": "Cover", "src": "./slides/01-cover.html"},
    {"id": "02-content", "label": "Content", "src": "./slides/02-content.html"}
  ],
  "tweaks_manifest": "./tweaks.json",
  "open_questions_count": 4,
  "next_action_hint": "Pick a cover direction and lock the accent color, then export — I'll apply across all slides."
}
```

When tweak-design's init script sees a `handoff.json` in the target directory, it uses that instead of the user-provided `--layouts` flag.

## Worked example

**huashu-design's internal questioning** (what it would normally ask the user):

1. "Cover background — dark or color-flood?"
2. "Title size — 96pt (default) or 132pt (bolder)?"
3. "Brand primary — keep `#5B8DEF` or shift to a stronger `#3B6FD8`?"
4. "Add a 'date' eyebrow above the title? (yes/no)"

**Converted to tweaks.json:**

```json
{
  "title": "Cover · Open questions",
  "selects": [
    {
      "id": "cover-bg",
      "label": "Cover background",
      "default": "dark",
      "ui": "segmented",
      "options": [
        {"value": "dark",  "label": "Dark",
         "css": {"--cover-bg-color": "#0F1118",
                 "--cover-text": "white"}},
        {"value": "flood", "label": "Color flood",
         "css": {"--cover-bg-color": "var(--brand-primary)",
                 "--cover-text": "#0F1118"}}
      ]
    },
    {
      "id": "show-eyebrow",
      "label": "Show date eyebrow",
      "default": "yes",
      "ui": "segmented",
      "options": [
        {"value": "yes", "label": "Yes", "css": {"--eyebrow-display": "block"}},
        {"value": "no",  "label": "No",  "css": {"--eyebrow-display": "none"}}
      ]
    }
  ],
  "size_tokens": [
    {"var": "--cover-title-size", "default": "96", "unit": "px", "min": 80, "max": 160, "step": 4, "label": "Cover title size"}
  ],
  "color_tokens": [
    {"var": "--brand-primary", "default": "#5B8DEF", "label": "Brand primary"}
  ]
}
```

The user opens tweak-design, sees these 4 controls, plays with them live, and the exported prompt comes back to huashu-design as:

```
## Tweaks (changed from default)
- `cover-bg`: dark → flood
- `--cover-title-size`: 96px → 128px
- `show-eyebrow`: yes → no

(--brand-primary unchanged)
```

huashu-design then applies these as the "answered questions" and proceeds with the batch generation of the remaining slides locked to those choices.

## Why this is better than asking text questions

1. **Visual feedback** — the user sees the consequence immediately, not imagined-from-text
2. **Low cognitive load** — clicking a toggle is faster than typing a paragraph response
3. **Reversible exploration** — try yellow, switch back to navy in 1 click; in chat that's a round trip
4. **Captures the "I prefer the navy but with the yellow's title size" kind of mix-and-match**, which is hard to articulate in text but trivial to do in tweak-design

## What huashu-design needs to ADD to support this

A new function in its workflow:
1. After generating defaults, identify which decisions were assumptions vs. locked answers
2. For each assumption, build a tweak entry per the schema in `references/tweaks-manifest-spec.md`
3. **Also annotate each significant element with `element_tweaks[]`** — see below
4. Write `tweaks.json` and `handoff.json` to the project root
5. Tell the user: "I generated defaults — open the playground to refine, or keep defaults if happy: `tweak-design /path/to/project`"

## element_tweaks: the design system's voice in the inspector

When the user clicks on an element in inspect mode, the playground shows a contextual mini-editor. **Without guidance, that editor falls back to a generic 6-prop set.** With `element_tweaks` declared, you tell the inspector "for THIS selector, these are the props that make design sense to expose".

This is the design system speaking through the tool — it's what stops the user from accidentally tweaking `display: none` on a title. Declare what matters:

```json
"element_tweaks": [
  {
    "selector": ".cover__title",
    "label": "Cover title",
    "props": ["font-size", "color", "font-weight", "letter-spacing"]
  },
  {
    "selector": ".cover__subtitle",
    "label": "Cover subtitle",
    "props": ["font-size", "line-height", "color"]
  },
  {
    "selector": ".signature-bar",
    "label": "Yellow accent bar",
    "props": ["background", "height", "width"]
  }
]
```

Rule of thumb: declare entries for any element where you, as the designer, have an opinion on which axes the human should be allowed to push — and which they shouldn't. If you skip an element, the user gets the generic fallback and may push axes you didn't intend.

The huashu-design SKILL.md should be updated to mention this handoff option as the new default flow for "design with open decisions" cases. (Out of scope for this skill — the change happens in huashu-design.)
