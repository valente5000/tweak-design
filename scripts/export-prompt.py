#!/usr/bin/env python3
"""Convert a session.json (saved by the playground) into the same markdown
prompt the in-browser export produces. Useful for headless / scripted flows
where you can't open the browser to copy from the modal.

Usage:
  python export-prompt.py /path/to/session.json
  python export-prompt.py /path/to/session.json --out feedback.md

Requires Python 3.10+.
"""

import argparse
import json
import sys
from pathlib import Path


def _layout_label(layouts: list, lid: str) -> str:
    for L in layouts:
        if L.get("id") == lid:
            return L.get("label") or lid
    return lid


def build_markdown(session: dict) -> str:
    lines = []
    lines.append("# Design review feedback")
    lines.append("")
    lines.append(f"_Project:_ {session.get('project') or 'untitled'}")
    lines.append(f"_Generated:_ {session.get('exported_at') or '(no timestamp)'}")
    lines.append("")

    layouts = session.get("layouts", [])
    defaults = session.get("defaults", {})
    tweak_values = session.get("tweakValues") or {}
    global_vals = tweak_values.get("_global", {})
    per_layout = tweak_values.get("perLayout", {})

    lines.append("## Tweaks")
    lines.append("")

    any_tweak = False
    if global_vals:
        any_tweak = True
        lines.append("### Global (apply to all layouts)")
        for k, v in global_vals.items():
            lines.append(f"- `{k}`: `{defaults.get(k)}` -> `{v}`")
        lines.append("")

    for lid, vals in per_layout.items():
        if not vals:
            continue
        any_tweak = True
        lines.append(f"### Per-layout - {_layout_label(layouts, lid)}")
        for k, v in vals.items():
            lines.append(f"- `{k}`: `{defaults.get(k)}` -> `{v}`")
        lines.append("")

    if not any_tweak:
        lines.append("_(no tweaks changed from default)_")
        lines.append("")

    element_overrides = session.get("elementOverrides") or {}
    el_layouts = [(lid, sels) for lid, sels in element_overrides.items() if sels]
    if el_layouts:
        lines.append("## Element overrides")
        for lid, sels in el_layouts:
            lines.append("")
            lines.append(f"### {_layout_label(layouts, lid)}")
            for selector, props in sels.items():
                lines.append(f"- **`{selector}`**")
                for p, v in props.items():
                    lines.append(f"  - `{p}`: `{v}`")
        lines.append("")

    lines.append("## Annotations")
    annotations = session.get("annotations", [])
    if not annotations:
        lines.append("_(no annotations)_")
    else:
        by_layout: dict[str, list] = {}
        for a in annotations:
            by_layout.setdefault(a["layoutId"], []).append(a)
        for lid, items in by_layout.items():
            lines.append("")
            lines.append(f"### {_layout_label(layouts, lid)}")
            for a in items:
                text = (a.get("text") or "").strip() or "_(no note)_"
                if a.get("type") == "pin":
                    lines.append(f"- Pin #{a['n']} at ({round(a['x'])}, {round(a['y'])}) - {text}")
                else:
                    x2, y2 = round(a["x"] + a["w"]), round(a["y"] + a["h"])
                    lines.append(
                        f"- Quadrant #{a['n']} ({round(a['x'])},{round(a['y'])})->({x2},{y2}) - {text}"
                    )
                    dom = a.get("dom") or []
                    if dom:
                        sels = ", ".join(f"`{s}`" for s in dom)
                        lines.append(f"  - DOM elements: {sels}")

    lines.append("")
    lines.append("## Suggested next prompt")
    lines.append(
        "> Apply tweaks above (respect Global vs Per-layout scope), apply element overrides as scoped CSS rules per layout, and address each annotation. For pins, treat coordinates as the focus point. For quadrants, the listed DOM elements are what to modify."
    )

    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser(description="export-prompt for tweak-design sessions")
    p.add_argument("session", type=Path, help="path to session.json")
    p.add_argument("--out", type=Path, default=None, help="write to file instead of stdout")
    args = p.parse_args()

    if not args.session.exists():
        print(f"ERROR: not found: {args.session}", file=sys.stderr)
        sys.exit(2)

    session = json.loads(args.session.read_text())
    md = build_markdown(session)

    if args.out:
        args.out.write_text(md)
        print(f"  wrote {args.out}")
    else:
        print(md)


if __name__ == "__main__":
    main()
