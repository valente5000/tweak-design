#!/usr/bin/env python3
"""Convert a session.json (saved by the playground) into the same markdown
prompt the in-browser export produces. Useful for headless / scripted flows
where you can't open the browser to copy from the modal.

Usage:
  python export-prompt.py /path/to/session.json
  python export-prompt.py /path/to/session.json --out feedback.md
"""

import argparse
import json
import sys
from pathlib import Path


def build_markdown(session: dict) -> str:
    lines = []
    lines.append("# Design review feedback")
    lines.append("")
    lines.append(f"_Project:_ {session.get('project') or 'untitled'}")
    lines.append(f"_Generated:_ {session.get('exported_at') or '(no timestamp)'}")
    lines.append("")

    defaults = session.get("defaults", {})
    values = session.get("tweakValues", {})

    lines.append("## Tweaks (changed from default)")
    any_change = False
    for k, v in values.items():
        if json.dumps(v) == json.dumps(defaults.get(k)):
            continue
        any_change = True
        lines.append(f"- `{k}`: `{defaults.get(k)}` → `{v}`")
    if not any_change:
        lines.append("_(no tweaks changed from default)_")
    lines.append("")

    lines.append("## Annotations")
    anns = session.get("annotations", [])
    if not anns:
        lines.append("_(no annotations)_")
    else:
        layouts = {L["id"]: L for L in session.get("layouts", [])}
        by_layout = {}
        for a in anns:
            by_layout.setdefault(a["layoutId"], []).append(a)
        for lid, items in by_layout.items():
            label = (layouts.get(lid) or {}).get("label", lid)
            lines.append("")
            lines.append(f"### {label}")
            for a in items:
                text = (a.get("text") or "").strip() or "_(no note)_"
                if a["type"] == "pin":
                    lines.append(f"- 📍 Pin #{a['n']} at ({round(a['x'])}, {round(a['y'])}) — {text}")
                else:
                    x2, y2 = round(a['x'] + a['w']), round(a['y'] + a['h'])
                    lines.append(f"- ▭ Quadrant #{a['n']} ({round(a['x'])},{round(a['y'])})→({x2},{y2}) — {text}")
                    dom = a.get("dom") or []
                    if dom:
                        sels = ", ".join(f"`{s}`" for s in dom)
                        lines.append(f"  - DOM elements: {sels}")

    lines.append("")
    lines.append("## Suggested next prompt")
    lines.append("> Apply the tweaks above globally and address each annotation. For pins, treat coordinates as where to focus the change. For quadrants, the listed DOM elements are what to modify.")

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
