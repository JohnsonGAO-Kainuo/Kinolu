#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import EditParams, apply_micro_edits, blend_xy_strength, run_transfer


METHODS = ["auto_best", "hybrid_auto", "reinhard_lab", "reinhard", "lhm"]


def parse_args():
    p = argparse.ArgumentParser(description="Compare color-transfer methods on one source/reference pair.")
    p.add_argument("--reference", required=True, help="Reference image path")
    p.add_argument("--source", required=True, help="Source image path")
    p.add_argument("--out-dir", default="out/method_compare", help="Output directory")
    p.add_argument("--color-strength", type=float, default=95.0)
    p.add_argument("--tone-strength", type=float, default=90.0)
    p.add_argument("--skin-strength", type=float, default=80.0)
    return p.parse_args()


def read_image(path: str):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read image: {path}")
    return img


def main():
    args = parse_args()
    ref = read_image(args.reference)
    src = read_image(args.source)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for method in METHODS:
        transferred = run_transfer(method, src, ref)
        blended = blend_xy_strength(
            source_bgr=src,
            transferred_bgr=transferred,
            color_strength=args.color_strength,
            tone_strength=args.tone_strength,
            skin_protect=True,
            skin_strength=args.skin_strength,
        )
        edited = apply_micro_edits(blended, EditParams())
        out_path = out_dir / f"{Path(args.source).stem}_{method}.jpg"
        cv2.imwrite(str(out_path), edited, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        print(f"saved {out_path}")


if __name__ == "__main__":
    main()
