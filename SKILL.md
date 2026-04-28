---
name: tweak-design
description: Open a local design-review playground for any HTML layout(s) — designers tweak CSS variables (colors, sizes, variation toggles) live in a sidebar, drop annotations (pins or quadrants that auto-highlight DOM elements within), compare up to 3 versions side-by-side via tabs/dropdown, and export a structured markdown prompt of "what to change". Trigger this skill ANY time the user wants to review, compare, tweak, annotate, mark up, give feedback on, or iterate on HTML designs/layouts/decks/prototypes — including phrases like "tweak this design", "review these covers", "compare these layouts", "give me a playground for X", "let me mark what to change", "annotate this slide", "open a design review", "side-by-side compare", "let me play with the colors". Especially useful as a follow-up to the huashu-design skill (which produces HTML decks/prototypes) — when huashu-design finishes generating layouts and would normally ask clarifying questions, those questions become live tweaks in this playground instead. Also use this when the user has 2+ design variants and needs to pick one, when they want non-developers to give visual feedback, or when feedback on a design needs to be captured in a structured way before being applied.
---

# tweak-design

A local-running design review playground. Loads HTML layouts in iframes; users tweak CSS variables in a sidebar (live updates), drop annotations on the canvas, compare up to 3 layouts side-by-side, then export a structured prompt that an agent can act on.

## When to invoke

Trigger when the user wants to:
- Review HTML designs / layouts / slide decks / prototypes interactively
- Compare 2+ design variants and pick one (or merge ideas)
- Tweak design tokens (colors, sizes, fonts, spacing) live and see the effect
- Annotate specific points or regions of a design with feedback
- Convert visual feedback into a structured prompt for the next agent iteration
- Continue an existing huashu-design session (it produces HTML decks; this skill picks them up)

If the user is just building a single new HTML layout and not reviewing/comparing/tweaking, use `huashu-design` or `frontend-design` instead — this skill is the **review-and-iterate** layer, not the **build** layer.

## Auto-detect & offer the bridge after huashu-design

When you (Claude) have just helped the user produce HTML layouts via the `huashu-design` skill — and `tweak-design` is also installed — proactively offer to open them in the tweak-design playground as the natural next step. This saves the user from having to think "what's the review tool again?".

**Detection — when to make the offer:**

Trigger the offer when ALL of these are true:
1. The current or just-prior conversational turn used `huashu-design` to create or refine layouts
2. The skill `huashu-design` is installed (verify quickly with `ls "$HOME/.claude/skills/huashu-design/SKILL.md"` — file exists ⇒ installed)
3. The user hasn't already opened a tweak-design playground for this project in the current session
4. There are at least 2 layouts produced (a single layout doesn't benefit much from the comparison view; for a single layout, only offer if the layouts have meaningful CSS variables to tweak)

If those are true, ask the user — in the language they've been using in the conversation. Don't translate the SKILL.md (it stays in EN), but match the user's voice in the prompt itself.

**Phrasing — examples by language:**

- **Português (pt-BR)**: "Acabei de gerar os layouts via huashu-design. Quero abrir o tweak-design pra você comparar lado-a-lado, ajustar tokens ao vivo e marcar o que mudar?"
- **English**: "I just generated the layouts via huashu-design. Want me to open them in tweak-design so you can compare side-by-side, tweak tokens live, and mark what to change?"
- **Español**: "Acabo de generar los layouts con huashu-design. ¿Quieres que los abra en tweak-design para comparar lado a lado y marcar cambios?"
- **中文**: "huashu-design 刚生成了几个 layout。要我用 tweak-design 打开它们吗？可以并排对比、实时调 tokens、标注要改的地方。"

The general rule: ask in whatever language the user has been speaking in the conversation. If unsure, default to English with a one-line PT-BR translation underneath. Don't ask twice in the same session if declined.

**If the user accepts, run the bridge:**

```bash
python "$HOME/.claude/skills/tweak-design/scripts/from-huashu-design.py" \
  --project <project-root>
```

This script reads any present `handoff.json` / `brand-spec.md` / `tweaks.json` produced by huashu-design, derives a manifest if one isn't already there, calls `init-playground.py`, and starts the server. Everything happens **inside the user's project directory** plus inside this skill's own files — the huashu-design skill directory is never touched. Both skills remain independently `git pull`-able.

If the user declines, drop the offer silently. Don't repeat it for the same set of layouts.

**Edge cases:**

- huashu-design installed but the layouts have no CSS vars and no tweaks.json → offer the bridge anyway; the playground still gives value (annotations, comparison, export)
- huashu-design NOT installed → no offer; just operate in standalone mode
- User mid-session changes mind ("on second thought, let's tweak that") → bootstrap on demand without asking again
- User is iterating on the SAME deck repeatedly → bootstrap once, after that nudge them to refresh the browser instead of re-bootstrapping

Why this matters: the friction between "skill A finished" and "skill B begins" is what kills cross-skill workflows. By making tweak-design auto-aware of huashu-design's completion, the user gets a continuous design experience without context-switching to remember which command opens what.

## What it produces

A self-contained local web app accessible at `http://127.0.0.1:7860/playground/playground.html` (port configurable). The user opens it in their browser, interacts, then clicks "Export prompt" to get a markdown block describing all changes. That block goes back into a Claude conversation to drive the next iteration.

Architecture:
```
<project-root>/
├── playground/                # this skill copies its template here
│   ├── playground.html
│   ├── playground.css
│   ├── playground.js
│   ├── server.py
│   ├── layouts.json           # generated by init script — points at the layouts to review
│   └── tweaks.json            # optional — defines named controls; auto-detected if absent
└── slides/ (or any folder)    # the HTML layouts to be reviewed (untouched by playground)
```

## Workflow

### 1 · Locate the layouts to review

Ask the user (or infer from conversation) which HTML files should be loaded. Common cases:
- Files just produced by huashu-design (look for `slides/*.html` or similar)
- A specific folder the user names
- A list of explicit paths

### 2 · Bootstrap the playground

Run the init script from the skill:
```bash
python "$HOME/.claude/skills/tweak-design/scripts/init-playground.py" \
  --project <project-root> \
  --layouts <path-to-layout-or-glob> [<path-2> ...] \
  [--tweaks-manifest <path-to-tweaks.json>]
```

This:
- Copies `assets/playground-template/` into `<project-root>/playground/`
- Writes `<project-root>/playground/layouts.json` listing every layout with id + label + relative src
- If `--tweaks-manifest` is given, copies that JSON into `<project-root>/playground/tweaks.json`
- Prints the next command to start the server

### 3 · Start the server, open the playground

```bash
cd <project-root>/playground
python server.py            # default port 7860, auto-opens browser
```

The user interacts in the browser. The skill's job here is mostly to wait — the playground is self-contained.

### 4 · Read back the export

When the user finishes and clicks "Export prompt", the markdown is on their clipboard. They'll paste it back into the Claude conversation. Treat that paste as a **structured change request** with two sections:
- **Tweaks** — concrete CSS-variable diffs to apply across layouts
- **Annotations** — pins (specific points) and quadrants (regions with associated DOM elements) tagged with the user's note

Apply the tweaks programmatically (edit CSS files / token files), then address each annotation as a focused design change.

If the user has the `export-prompt.py` script set up to autosave annotations as `session.json`, read that file directly instead of relying on the paste.

## Integration with huashu-design (the bridge)

`huashu-design` normally has a "clarifying questions" phase where it asks the user about ambiguous design decisions before generating. This skill **inverts that flow**:

1. huashu-design generates 1-3 default layouts using best-guess defaults
2. **The unanswered questions become tweaks in `tweaks.json`** (e.g., "Cover background?" becomes a select control with options "navy" / "yellow")
3. tweak-design opens those layouts + the manifest
4. User answers questions by **toggling controls and seeing the result live** instead of reading text questions and imagining the result
5. Export prompt feeds back into huashu-design (or any agent) to lock in the choices and refine

The full bridge spec is in `references/huashu-design-bridge.md` — read it when bootstrapping a tweak-design session for huashu-design output, or when modifying huashu-design to produce manifests for this skill.

## Tweaks manifest format

The `tweaks.json` file is what makes the sidebar smart. Without it, the playground auto-detects CSS custom properties from the layouts and renders generic color pickers + sliders. With it, you get labeled, semantic controls grouped by concern.

Full schema in `references/tweaks-manifest-spec.md`. Quick example:

```json
{
  "color_tokens": [
    {"var": "--brand-primary", "default": "#5B8DEF", "label": "Brand primary"}
  ],
  "size_tokens": [
    {"var": "--cover-title-size", "default": "104", "unit": "px", "min": 60, "max": 240, "label": "Cover title size"}
  ],
  "selects": [
    {
      "id": "cover-bg",
      "label": "Cover background",
      "applies_to": ["01-cover.html"],
      "options": [
        {"value": "dark",  "label": "Dark",  "css": {"--cover-bg": "#0F1118", "--cover-text": "white"}},
        {"value": "light", "label": "Light", "css": {"--cover-bg": "#F5F5F7", "--cover-text": "#0F1118"}}
      ],
      "default": "dark"
    }
  ]
}
```

## View modes

The playground supports 3 view modes via top-bar buttons:
- **Single** — one layout fills the canvas; tabs/dropdown at top switch which layout
- **2-up split** — two panes; each pane has its own layout dropdown
- **3-up split** — three panes; same

When the user finishes comparing in split mode and wants to apply tweaks to just one layout, they switch to single mode and the layout dropdown becomes the primary navigation.

## Annotations

- **Pin** — single click on a layout drops a numbered red dot at that point
- **Quadrant** — drag on a layout draws a yellow rectangle; on release, the playground queries the iframe DOM for elements within that rectangle and adds a dashed outline to them. The export prompt lists those elements by selector path so the next agent knows exactly what to change.

Annotations only register when **inspect mode is OFF**. Toggle inspect with the 🎯 button or `i` shortcut.

Each annotation is editable in the sidebar list. All annotations + tweaks auto-save to localStorage on every change. The "Save .json" button writes a portable `session.json` that survives across browsers and machines.

## Synthesize the manifest yourself before bootstrapping

**You (the agent — Claude Code, Codex, or any other coding assistant) are the synthesizer.** This skill ships no LLM-calling code on purpose: a script invoked headlessly cannot share the calling agent's auth (no shared API key, no shared session), and we don't want the skill to require an `ANTHROPIC_API_KEY` env var to be useful. The right place to do the analysis is your own context, where you already have model access.

**When to synthesize:** Before running `from-huashu-design.py` or `init-playground.py` for layouts that have **no `tweaks.json`** in the project root (and especially when no `brand-spec.md` exists either — the regex fallback in `derive_tweaks_from_brand_spec` only captures colors).

**How to synthesize, in 4 steps:**

1. **Read the layout HTMLs.** Open up to 6 of them; cap each at ~50KB if huge. Pay attention to the `<style>` blocks: which CSS custom properties are declared in `:root`, and (more importantly) which are **actually consumed** via `var(--x)` in the rest of the CSS. Hardcoded values that aren't behind a var won't be tweakable as `size_tokens` — declaring a slider for them produces a no-op control.
2. **Read `references/tweaks-manifest-spec.md`** — the canonical schema. Match it.
3. **Author a `tweaks.json`** at `<project-root>/tweaks.json` (NOT inside `playground/` — the bridge will copy it from the project root automatically). Aim for:
   - **`color_tokens`** for every meaningful CSS color var, with `applies_to` set per layout when colors differ between variants.
   - **`size_tokens`** ONLY for vars genuinely consumed by the CSS (otherwise skip; don't pollute the sidebar with sliders that do nothing).
   - **`selects`** for either/or design decisions where you can map each option to concrete CSS-var changes — these are huge UX wins (palette swaps, layout-direction toggles, density modes).
   - **`element_tweaks`** (CRITICAL) — for every visual anchor you can identify: hero headline, story headline, byline, tag/eyebrow, CTA, accent bar, image frame, masthead, footer. For each, list ONLY the CSS props that make design sense (e.g., `font-size + font-weight + letter-spacing + color` for a headline, not `display`/`position`). These work via the inspector mini-editor and apply via inline style — they always work, even when the layout uses no CSS vars.
4. **Bootstrap.** Run `from-huashu-design.py --project <root>` (or `init-playground.py` directly). The bridge will detect `<project>/tweaks.json` and pass it through to the playground.

**Why this design:** earlier versions of this skill tried to invoke the `claude` CLI via subprocess to do the synthesis. That broke for any user without `ANTHROPIC_API_KEY` set headlessly, and produced a confusing failure mode. Putting the synthesis where the agent already lives — your conversation — is more reliable, runs in any agent (Claude Code / Codex / Cursor / etc.), and gives you the full context to make better calls than a one-shot CLI invocation could.

## Defaults: ask the designer first, measure as fallback, never invent

The trust order for the manifest, summarized:

1. **(Best) Author the manifest yourself, as the agent.** See "Synthesize the manifest yourself" above. You read the layouts, write `<project>/tweaks.json`, then bootstrap.
2. **(Fallback) Measure the loaded HTML at runtime.** When no `tweaks.json` is present, the playground scans the layouts for CSS custom properties and ranks them by reference frequency (`var(--x)` count). Top N are surfaced as auto-detected tokens. This handles the "I forgot to write a manifest" case but loses size_tokens / selects / element_tweaks.
3. **(Last resort) Generic neutral controls.** When neither (1) nor (2) yields useful signal, fall back to a tiny neutral default set (font-size, color, padding) on a single placeholder selector — clearly labeled as fallback so the user knows the tool is guessing.

**Never** inject specific brand colors, brand names, or pre-baked design opinions. The playground UI's own accent color is also derived from the loaded design's first color token at runtime — the tool wears the design system it is reviewing, not the other way around.

If the user asks for the playground without a manifest AND a design-creator skill is detectable, surface that as a suggestion before falling back to (2): _"This deck looks like it came from huashu-design. Want me to ask huashu-design to declare which tokens/elements matter before we open? Otherwise I'll auto-rank by frequency."_

## Per-layout scoping (v2 default)

Every tweak — global tokens AND element-level overrides — applies **only to the layout currently in focus** by default. Each control has a 📍/🌐 chip:
- 📍 (default) — value applies just to this layout
- 🌐 — promote to global; applies to all layouts that don't have a per-layout override

Resolution cascade (CSS-style): per-layout > global > manifest default. Switching layouts redraws the sidebar to show effective values, with a small "🌐 inherited" hint when a value is coming from global.

This matters because in a deck of 7 slides, the user usually wants to test "what if THIS title was bigger" without nuking every other title. Global is opt-in.

## Element inspector (v2)

A 🎯 button in the top bar (shortcut `i`) toggles inspect mode. With it on:
- Hover over any element in a layout → outlined in cyan
- Click → element selected, mini-editor appears in the sidebar with **only the props the manifest declares as meaningful for that selector** (via `element_tweaks` in `tweaks.json`)
- For elements not declared in the manifest, fallback set: font-size, color, font-weight, letter-spacing, line-height, padding

Element overrides also follow per-layout scoping (they default to "this layout only"). See `references/tweaks-manifest-spec.md` for the `element_tweaks` schema and `references/huashu-design-bridge.md` for how the design-system skill (e.g., huashu-design) should annotate its elements.

## When NOT to invoke

- Pure code review (use a code-review skill)
- Layout creation from scratch (use huashu-design or frontend-design)
- Single-file static HTML editing without comparison/review intent (just use Edit)
- Print/PDF generation (use the parent skill's export scripts)

## Self-test

The skill ships with a tiny self-test in `assets/playground-template/_example/`. From a fresh shell:

```bash
cd "$HOME/.claude/skills/tweak-design/assets/playground-template/_example"
python ../server.py
```

Browser opens at `http://127.0.0.1:7860/playground/playground.html` with two synthetic demo HTMLs and a tweaks.json wired up. Use it to verify the install before pointing at real work. The example deliberately uses placeholder colors (`#5B8DEF`) and generic class names (`.title`, `.subtitle`) — no real brand contamination.

## File index

- `assets/playground-template/` — the front-end (HTML/CSS/JS + server.py); copied into each project that bootstraps
- `scripts/init-playground.py` — bootstrap script that copies template + writes `layouts.json`
- `scripts/export-prompt.py` — converts a session.json (saved by user) into the same markdown prompt the in-browser export produces; useful for headless/automated flows
- `references/tweaks-manifest-spec.md` — full JSON schema for `tweaks.json`
- `references/huashu-design-bridge.md` — how to make huashu-design produce a tweaks manifest from its clarifying questions
