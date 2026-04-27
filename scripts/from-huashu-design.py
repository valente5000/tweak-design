#!/usr/bin/env python3
"""Bridge: bootstrap a tweak-design playground from a huashu-design project.

This is the auto-bridge invoked when the user accepts tweak-design's offer
to continue from a just-finished huashu-design session. It reads whatever
huashu-design left in the project root (handoff.json, brand-spec.md, slides/)
and stitches them into the playground.

Usage:
  python from-huashu-design.py --project /path/to/project
  python from-huashu-design.py --project /path/to/project --no-server

Git-safety:
  This script ONLY writes to:
    - <project>/playground/                 (created if absent)
    - <project>/tweaks.json                 (only if not already present and we derive one)
  It NEVER writes to ~/.claude/skills/huashu-design/ — both skills stay
  independently `git pull`-able.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
INIT_SCRIPT = SCRIPT_DIR / "init-playground.py"
TEMPLATE = SKILL_ROOT / "assets" / "playground-template"


def find_layouts(project: Path) -> list[Path]:
    """Find HTML layouts produced by huashu-design.

    huashu-design conventions: layouts live in <project>/slides/*.html,
    sometimes <project>/layouts/*.html. Walk both.
    """
    candidates = []
    for sub in ("slides", "layouts"):
        d = project / sub
        if d.is_dir():
            candidates.extend(sorted(d.glob("*.html")))
    if not candidates:
        # Fallback: any *.html in project root that isn't index/playground
        for p in sorted(project.glob("*.html")):
            if p.name not in ("index.html", "playground.html"):
                candidates.append(p)
    return candidates


def read_handoff(project: Path) -> dict | None:
    p = project / "handoff.json"
    if p.is_file():
        try: return json.loads(p.read_text())
        except Exception: return None
    return None


def derive_tweaks_from_brand_spec(project: Path) -> dict | None:
    """Best-effort: scan brand-spec.md for color hex tokens and font tokens
    and build a minimal tweaks.json. The user (or huashu-design) is encouraged
    to provide a richer manifest, but this fallback is better than nothing.
    """
    spec = project / "brand-spec.md"
    if not spec.is_file():
        return None
    text = spec.read_text()

    # Extract `--var-name`: `#hex` patterns from typical brand-spec markdown tables
    color_re = re.compile(r"`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9A-Fa-f]{3,8})`")
    colors = []
    seen = set()
    for m in color_re.finditer(text):
        var_name, hex_val = m.group(1), m.group(2)
        if var_name in seen: continue
        seen.add(var_name)
        label = var_name.lstrip("-").replace("-", " ").title()
        colors.append({"var": var_name, "default": hex_val, "label": label, "group": "brand"})

    if not colors:
        # Try alternative format: `--var: #HEX` raw
        alt = re.compile(r"(--[a-z0-9-]+)\s*[:=]\s*(#[0-9A-Fa-f]{3,8})")
        for m in alt.finditer(text):
            var_name, hex_val = m.group(1), m.group(2)
            if var_name in seen: continue
            seen.add(var_name)
            label = var_name.lstrip("-").replace("-", " ").title()
            colors.append({"var": var_name, "default": hex_val, "label": label, "group": "brand"})

    if not colors:
        return None

    return {
        "title": "Auto-derived from brand-spec.md",
        "color_tokens": colors,
        "groups": [{"id": "brand", "label": "Brand tokens", "order": 1}],
    }


def main():
    p = argparse.ArgumentParser(description="tweak-design bridge from huashu-design output")
    p.add_argument("--project", required=True, type=Path, help="project root with huashu-design output")
    p.add_argument("--port", type=int, default=7860)
    p.add_argument("--no-server", action="store_true", help="bootstrap but don't start the server")
    p.add_argument("--no-browser", action="store_true", help="don't auto-open browser")
    args = p.parse_args()

    project = args.project.resolve()
    if not project.is_dir():
        print(f"ERROR: project dir does not exist: {project}", file=sys.stderr)
        sys.exit(2)

    layouts = find_layouts(project)
    if not layouts:
        print(f"ERROR: no HTML layouts found in {project}/slides/, {project}/layouts/, or root", file=sys.stderr)
        print("  huashu-design typically writes to ./slides/*.html — confirm the layouts exist.", file=sys.stderr)
        sys.exit(2)

    print(f"  Found {len(layouts)} layout{'s' if len(layouts) != 1 else ''}:")
    for L in layouts: print(f"    · {L.relative_to(project)}")

    # Title from handoff.json or fallback to project name
    handoff = read_handoff(project)
    title = (handoff or {}).get("project_title") or project.name

    # tweaks.json: prefer existing, else derive from brand-spec.md, else skip (auto-detect at runtime)
    tweaks_path = project / "tweaks.json"
    if not tweaks_path.is_file():
        derived = derive_tweaks_from_brand_spec(project)
        if derived:
            tweaks_path.write_text(json.dumps(derived, indent=2, ensure_ascii=False))
            print(f"  derived tweaks.json from brand-spec.md ({len(derived['color_tokens'])} color tokens)")
        else:
            print("  no tweaks.json or brand-spec.md — playground will auto-detect CSS vars at runtime")

    # Call init-playground.py
    cmd = [
        sys.executable, str(INIT_SCRIPT),
        "--project", str(project),
        "--layouts", *[str(L) for L in layouts],
        "--title", title,
        "--force",
    ]
    if tweaks_path.is_file():
        cmd += ["--tweaks-manifest", str(tweaks_path)]

    print()
    print("  Bootstrapping playground...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ERROR: init-playground failed:\n{r.stderr}", file=sys.stderr)
        sys.exit(r.returncode)
    print(r.stdout.strip())

    if args.no_server:
        return

    pg_dir = project / "playground"
    server_cmd = [sys.executable, str(pg_dir / "server.py"), "--port", str(args.port)]
    if args.no_browser: server_cmd.append("--no-browser")
    print()
    print("  Starting server...")
    print(f"  ({'Press Ctrl+C to stop' if not args.no_browser else 'Browser auto-open OFF'})")
    print()
    os.chdir(pg_dir)
    os.execvp(server_cmd[0], server_cmd)


if __name__ == "__main__":
    main()
