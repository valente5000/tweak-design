#!/usr/bin/env python3
"""Local server for the tweak-design playground.

Run from inside <project>/playground/ — it serves the parent project so iframe
srcs like ../slides/x.html resolve correctly.
"""

import argparse
import http.server
import os
import socketserver
import sys
import webbrowser
from pathlib import Path


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"  {self.address_string()} - {fmt % args}\n")


def main():
    p = argparse.ArgumentParser(description="tweak-design playground server")
    p.add_argument("--port", type=int, default=7860)
    p.add_argument("--bind", default="127.0.0.1")
    p.add_argument("--no-browser", action="store_true")
    args = p.parse_args()

    server_dir = Path(__file__).resolve().parent
    project_root = server_dir.parent
    os.chdir(project_root)

    sub = server_dir.name
    url = f"http://{args.bind}:{args.port}/{sub}/playground.html"

    with socketserver.ThreadingTCPServer((args.bind, args.port), Handler) as httpd:
        print()
        print("  tweak-design playground")
        print("  " + "─" * 24)
        print(f"  Serving:  {project_root}")
        print(f"  Open at:  {url}")
        print(f"  Stop:     Ctrl+C")
        print()
        if not args.no_browser:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Shutting down.")


if __name__ == "__main__":
    main()
