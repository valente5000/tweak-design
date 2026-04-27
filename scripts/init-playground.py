#!/usr/bin/env python3
"""Bootstrap a tweak-design playground inside a project directory.

Usage:
  python init-playground.py \
    --project /path/to/project \
    --layouts /path/to/slide.html [/path/to/slide2.html ...] \
    [--tweaks-manifest /path/to/tweaks.json] \
    [--title "My deck review"]

Effect:
  <project>/playground/                  # copied template
  <project>/playground/layouts.json      # generated from --layouts
  <project>/playground/tweaks.json       # copied from --tweaks-manifest if given

Then:
  cd <project>/playground
  python server.py
"""

import argparse
import glob
import json
import shutil
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
TEMPLATE_DIR = SKILL_ROOT / "assets" / "playground-template"


def expand_layout_paths(patterns):
    """Accept literal paths or shell globs. Return sorted unique absolute paths."""
    out = []
    for p in patterns:
        matches = sorted(glob.glob(p))
        if not matches and Path(p).exists():
            matches = [p]
        if not matches:
            print(f"  WARN: no match for {p}", file=sys.stderr)
        for m in matches:
            ap = str(Path(m).resolve())
            if ap not in out:
                out.append(ap)
    return out


def derive_label(path: Path) -> str:
    return path.stem.replace("-", " ").replace("_", " ").title()


def main():
    p = argparse.ArgumentParser(description="Bootstrap tweak-design playground")
    p.add_argument("--project", required=True, type=Path, help="project root (where playground/ will be created)")
    p.add_argument("--layouts", required=True, nargs="+", help="layout HTML files (paths or globs)")
    p.add_argument("--tweaks-manifest", type=Path, default=None, help="optional tweaks.json to copy in")
    p.add_argument("--title", default=None, help="project title shown in playground header")
    p.add_argument("--force", action="store_true", help="overwrite existing playground/")
    args = p.parse_args()

    project = args.project.resolve()
    if not project.exists():
        print(f"ERROR: project dir does not exist: {project}", file=sys.stderr)
        sys.exit(2)

    pg_dir = project / "playground"
    if pg_dir.exists() and not args.force:
        print(f"  playground/ already exists at {pg_dir} — use --force to overwrite layouts.json/tweaks.json without re-copying assets", file=sys.stderr)
        # In non-force mode, only refresh layouts.json (preserve any user edits to template files)
    else:
        if pg_dir.exists() and args.force:
            shutil.rmtree(pg_dir)
        shutil.copytree(TEMPLATE_DIR, pg_dir, dirs_exist_ok=True)
        print(f"  copied template → {pg_dir}")

    # Build layouts.json
    layouts = []
    for raw in expand_layout_paths(args.layouts):
        ap = Path(raw).resolve()
        try:
            rel = ap.relative_to(project)
        except ValueError:
            print(f"  WARN: {ap} is outside project root, using absolute path", file=sys.stderr)
            rel = ap
        # src is relative to playground/playground.html, which is inside project/playground/
        # so to reach project/slides/foo.html we use ../slides/foo.html
        src = "../" + str(rel).replace("\\", "/") if not str(rel).startswith("/") else f"file://{rel}"
        layouts.append({
            "id": ap.stem,
            "label": derive_label(ap),
            "src": src,
        })

    if not layouts:
        print("ERROR: no layouts found", file=sys.stderr)
        sys.exit(2)

    manifest = {
        "title": args.title or project.name,
        "layouts": layouts,
    }
    if args.tweaks_manifest:
        tweaks_src = args.tweaks_manifest.resolve()
        if not tweaks_src.exists():
            print(f"ERROR: --tweaks-manifest path missing: {tweaks_src}", file=sys.stderr)
            sys.exit(2)
        tweaks_dest = pg_dir / "tweaks.json"
        shutil.copy2(tweaks_src, tweaks_dest)
        manifest["tweaks_manifest"] = "./tweaks.json"
        print(f"  copied tweaks manifest → {tweaks_dest}")

    layouts_path = pg_dir / "layouts.json"
    layouts_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"  wrote {layouts_path} ({len(layouts)} layout{'s' if len(layouts) != 1 else ''})")

    print()
    print(f"  Next:  cd {pg_dir}")
    print(f"         python server.py")
    print()


if __name__ == "__main__":
    main()
