#!/usr/bin/env python3
"""Download the study images listed in data/sources.json.

Images are NOT committed to the repo (copyright); this script re-fetches them
from their original (mostly Wikimedia Commons) URLs so the pipeline is
reproducible. Wikimedia rate-limits aggressively: we send a descriptive
User-Agent and pace requests, retrying with backoff on 429.

Usage:
    python3 scripts/download_images.py [--only id1 id2 ...]
"""
import argparse
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
IMAGES = os.path.join(DATA, "images")

# Wikimedia's robot policy requires a descriptive User-Agent with contact info.
UA = ("grip-study-downloader/0.1 "
      "(research use; contact: zack@zacharymaril.com) python-urllib")


def fetch(url: str, dest: str, retries: int = 4) -> bool:
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(dest, "wb") as f:
                f.write(data)
            return True
        except Exception as e:  # noqa: BLE001 - report and retry
            print(f"  retry {attempt + 1}/{retries}: {e}", file=sys.stderr)
            time.sleep(8 * (attempt + 1))
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="only download these image ids")
    args = ap.parse_args()

    with open(os.path.join(DATA, "sources.json")) as f:
        sources = json.load(f)
    os.makedirs(IMAGES, exist_ok=True)

    ok = fail = skipped = 0
    for s in sources["images"]:
        if args.only and s["id"] not in args.only:
            continue
        ext = os.path.splitext(s["download_url"].split("?")[0])[1].lower() or ".jpg"
        dest = os.path.join(IMAGES, s["id"] + ext)
        if os.path.exists(dest):
            skipped += 1
            continue
        print(f"downloading {s['id']} ...")
        if fetch(s["download_url"], dest):
            ok += 1
        else:
            fail += 1
            print(f"FAILED: {s['id']}", file=sys.stderr)
        time.sleep(3)  # be polite to Wikimedia

    print(f"downloaded={ok} skipped(existing)={skipped} failed={fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
