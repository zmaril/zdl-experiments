#!/usr/bin/env python3
"""Run MediaPipe HandLandmarker on every study image.

Three detection passes per image:
  strict  - min_hand_detection_confidence = 0.5
  loose   - min_hand_detection_confidence = 0.2
  padded  - loose pass on a copy with a 35% gray border (MediaPipe's palm
            detector often misses hands that fill the frame; padding shrinks
            them relative to the canvas). Coordinates are mapped back.
The saved landmarks come from whichever of loose/padded found more hands.

Outputs:
  data/landmarks.json   - per image: hand counts per pass, handedness,
                          detection scores, all 21 normalized + world
                          landmarks per hand.
  data/overlays/        - landmark skeletons drawn over each photo, for
                          visual audit of hallucinated/occluded fingers.
                          (gitignored: contains the copyrighted photos)

The model file (hand_landmarker.task, ~7.8 MB) is auto-downloaded from
Google's model zoo on first run.

Usage:
    python3 scripts/extract_landmarks.py
"""
import json
import os
import sys
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
IMAGES = os.path.join(DATA, "images")
OVERLAYS = os.path.join(DATA, "overlays")
MODEL = os.path.join(HERE, "hand_landmarker.task")
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/1/hand_landmarker.task")

# MediaPipe hand skeleton edges (21-landmark topology).
CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (5, 9), (9, 10), (10, 11), (11, 12),     # middle
    (9, 13), (13, 14), (14, 15), (15, 16),   # ring
    (13, 17), (17, 18), (18, 19), (19, 20),  # pinky
    (0, 17),
]
COLORS = [(0, 200, 255), (255, 120, 0), (0, 255, 120), (255, 0, 200)]


def ensure_model() -> None:
    if not os.path.exists(MODEL):
        print("downloading hand_landmarker.task ...")
        urllib.request.urlretrieve(MODEL_URL, MODEL)


def make_landmarker(min_conf: float) -> "vision.HandLandmarker":
    opts = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=4,
        min_hand_detection_confidence=min_conf,
    )
    return vision.HandLandmarker.create_from_options(opts)


def load_rgb(path: str):
    """Robustly load an image as 3-channel RGB uint8 (handles gray/alpha)."""
    import numpy as np
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)  # forces 3 channels
    if bgr is None:
        return None
    return np.ascontiguousarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))


def detect(landmarker, rgb, pad_frac: float = 0.0):
    """Run detection; optionally on a gray-padded canvas, mapping coords back."""
    import numpy as np
    if pad_frac > 0:
        h, w = rgb.shape[:2]
        ph, pw = int(h * pad_frac), int(w * pad_frac)
        canvas = np.full((h + 2 * ph, w + 2 * pw, 3), 128, dtype=np.uint8)
        canvas[ph:ph + h, pw:pw + w] = rgb
        rgb_in = canvas
    else:
        rgb_in = rgb
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_in)
    res = landmarker.detect(img)
    hands = []
    for i, lms in enumerate(res.hand_landmarks):
        pts = []
        for p in lms:
            x, y, z = p.x, p.y, p.z
            if pad_frac > 0:
                H, W = rgb_in.shape[:2]
                h, w = rgb.shape[:2]
                x = (x * W - (W - w) / 2) / w
                y = (y * H - (H - h) / 2) / h
            pts.append([round(x, 5), round(y, 5), round(z, 5)])
        hands.append({
            "handedness": res.handedness[i][0].category_name,
            "score": round(res.handedness[i][0].score, 4),
            "landmarks": pts,
            "world_landmarks": [[round(p.x, 5), round(p.y, 5), round(p.z, 5)]
                                for p in res.hand_world_landmarks[i]],
        })
    return hands


def draw_overlay(path: str, hands, dest: str) -> None:
    img = cv2.imread(path)
    if img is None:
        return
    h, w = img.shape[:2]
    for hi, hand in enumerate(hands):
        color = COLORS[hi % len(COLORS)]
        pts = [(int(x * w), int(y * h)) for x, y, _ in hand["landmarks"]]
        for a, b in CONNECTIONS:
            cv2.line(img, pts[a], pts[b], color, 2)
        for p in pts:
            cv2.circle(img, p, 4, (255, 255, 255), -1)
            cv2.circle(img, p, 4, color, 1)
        cv2.putText(img, f"{hand['handedness']} {hand['score']:.2f}",
                    (pts[0][0], pts[0][1] + 20), cv2.FONT_HERSHEY_SIMPLEX,
                    0.7, color, 2)
    cv2.imwrite(dest, img)


def main() -> int:
    ensure_model()
    os.makedirs(OVERLAYS, exist_ok=True)

    with open(os.path.join(DATA, "sources.json")) as f:
        sources = json.load(f)
    by_id = {s["id"]: s for s in sources["images"]}

    strict = make_landmarker(0.5)
    loose = make_landmarker(0.2)

    results = {}
    files = sorted(os.listdir(IMAGES)) if os.path.isdir(IMAGES) else []
    for fn in files:
        img_id, ext = os.path.splitext(fn)
        if ext.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        path = os.path.join(IMAGES, fn)
        rgb = load_rgb(path)
        if rgb is None:
            print(f"{img_id}: unreadable, skipped")
            continue
        hands_strict = detect(strict, rgb)
        hands_loose = detect(loose, rgb)
        hands_padded = detect(loose, rgb, pad_frac=0.35)
        best, variant = ((hands_padded, "padded_0.2")
                         if len(hands_padded) > len(hands_loose)
                         else (hands_loose, "loose_0.2"))
        results[img_id] = {
            "file": fn,
            "grip_label": by_id.get(img_id, {}).get("grip_label", "?"),
            "n_hands_strict_0.5": len(hands_strict),
            "n_hands_loose_0.2": len(hands_loose),
            "n_hands_padded_0.2": len(hands_padded),
            "best_variant": variant,
            "n_hands": len(best),
            "hands": best,
        }
        draw_overlay(path, best,
                     os.path.join(OVERLAYS, img_id + "_overlay.jpg"))
        print(f"{img_id}: strict={len(hands_strict)} loose={len(hands_loose)} "
              f"padded={len(hands_padded)} label={results[img_id]['grip_label']}")

    out = os.path.join(DATA, "landmarks.json")
    with open(out, "w") as f:
        json.dump(results, f, indent=1)
    print(f"wrote {out} ({len(results)} images)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
