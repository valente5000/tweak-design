#!/usr/bin/env python3
"""Bridge: bootstrap a tweak-design playground from a huashu-design project.

This is the auto-bridge invoked when the user accepts tweak-design's offer
to continue from a just-finished huashu-design session. It reads whatever
huashu-design left in the project root (handoff.json, brand-spec.md, slides/)
and stitches them into the playground.

Usage:
  python from-huashu-design.py --project /path/to/project
  python from-huashu-design.py --project /path/to/project --no-server

Manifest synthesis:
  This script does NOT call any LLM. The reasoning is intentional: a script
  invoked headlessly cannot rely on the calling agent's auth (no shared API
  key, no shared session). Instead, the manifest is expected to be authored
  by the *agent* (Claude Code, Codex, etc.) BEFORE this script runs — see
  SKILL.md → "Synthesize the manifest yourself before bootstrapping". The
  agent reads the layouts, writes <project>/tweaks.json, and then runs this
  script. We just discover what's there.

Resolution order for the tweaks manifest:
  1. <project>/tweaks.json                    (agent-authored, preferred)
  2. derive from <project>/brand-spec.md      (regex extraction, color-only)
  3. nothing — playground falls back to its built-in CSS-var auto-detect

Git-safety:
  This script ONLY writes to:
    - <project>/playground/                 (created if absent)
    - $TMPDIR/<random>.tweaks.json          (transient; deleted after init copies
                                             it into <project>/playground/)
  It NEVER writes to <project>/ root or ~/.claude/skills/huashu-design/ —
  the user's project tree stays clean and both skills remain independently
  `git pull`-able.

Requires Python 3.10+.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
INIT_SCRIPT = SCRIPT_DIR / "init-playground.py"
TEMPLATE = SKILL_ROOT / "assets" / "playground-template"


def find_layouts(project: Path) -> list[Path]:
    """Find HTML layouts produced by a design-creator skill.

    Searches these subdirectories of <project> and accumulates ALL matches
    (not just the first one that exists):
      slides/, layouts/, design-explorations/, pages/, screens/

    If none of those exist, falls back to <project>/*.html (excluding
    index.html and playground.html).
    """
    candidates = []
    for sub in ("slides", "layouts", "design-explorations", "pages", "screens"):
        d = project / sub
        if d.is_dir():
            candidates.extend(sorted(d.glob("*.html")))
    if not candidates:
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
    """Best-effort: scan brand-spec.md for color hex tokens and build a minimal
    tweaks.json. Color-only — for richer manifests, the agent should author
    <project>/tweaks.json directly (see SKILL.md).
    """
    spec = project / "brand-spec.md"
    if not spec.is_file():
        return None
    text = spec.read_text()

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
    p.add_argument("--port", type=int, default=7860, help="port for the local playground server (default: 7860)")
    p.add_argument("--no-server", action="store_true", help="bootstrap but don't start the server")
    p.add_argument("--no-browser", action="store_true", help="don't auto-open browser")
    args = p.parse_args()

    project = args.project.resolve()
    if not project.is_dir():
        print(f"ERROR: project dir does not exist: {project}", file=sys.stderr)
        sys.exit(2)

    layouts = find_layouts(project)
    if not layouts:
        print(f"ERROR: no HTML layouts found under {project}", file=sys.stderr)
        print("  Looked in: slides/, layouts/, design-explorations/, pages/, screens/, root", file=sys.stderr)
        sys.exit(2)

    print(f"  Found {len(layouts)} layout{'s' if len(layouts) != 1 else ''}:")
    for L in layouts: print(f"    · {L.relative_to(project)}")

    handoff = read_handoff(project)
    title = (handoff or {}).get("project_title") or project.name

    tweaks_path: Path | None = None
    derived_tmp: Path | None = None

    user_supplied = project / "tweaks.json"
    if user_supplied.is_file():
        tweaks_path = user_supplied
        print(f"  using agent-authored manifest at {user_supplied.relative_to(project)}")
    else:
        derived = derive_tweaks_from_brand_spec(project)
        if derived:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".tweaks.json", delete=False, encoding="utf-8"
            ) as f:
                json.dump(derived, f, indent=2, ensure_ascii=False)
                derived_tmp = Path(f.name)
            tweaks_path = derived_tmp
            print(f"  derived tweaks manifest from brand-spec.md ({len(derived['color_tokens'])} color tokens)")
        else:
            print("  no tweaks.json or brand-spec.md - playground will auto-detect CSS vars at runtime")
            print("  (for a richer manifest, ask the agent to synthesize one — see tweak-design SKILL.md)")

    cmd = [
        sys.executable, str(INIT_SCRIPT),
        "--project", str(project),
        "--layouts", *[str(L) for L in layouts],
        "--title", title,
        "--force",
    ]
    if tweaks_path is not None:
        cmd += ["--tweaks-manifest", str(tweaks_path)]

    print()
    print("  Bootstrapping playground...")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    finally:
        if derived_tmp is not None:
            derived_tmp.unlink(missing_ok=True)
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
