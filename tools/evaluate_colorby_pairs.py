#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys
from typing import Dict, List

import cv2
import numpy as np
from skimage.metrics import structural_similarity

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import blend_xy_strength, recommend_xy_strength, run_transfer


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate Kinolu methods against mapped Colorby pairs.")
    p.add_argument("--pairs-csv", required=True, help="CSV with columns: reference_path,source_path,colorby_path,pair_id")
    p.add_argument("--methods", default="reinhard_lab,hybrid_auto,reinhard,lhm,auto_best")
    p.add_argument("--cinematic-strength", type=float, default=72.0)
    p.add_argument("--use-auto-xy", type=int, default=1)
    p.add_argument("--color-strength", type=float, default=88.0)
    p.add_argument("--tone-strength", type=float, default=78.0)
    p.add_argument("--skin-protect", type=int, default=0)
    p.add_argument("--skin-strength", type=float, default=70.0)
    p.add_argument("--semantic-regions", type=int, default=1)
    p.add_argument("--out-dir", default="out/eval_colorby_pairs")
    return p.parse_args()


def _read_bgr(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read image: {path}")
    return img


def _distance_to_colorby(candidate_bgr: np.ndarray, colorby_bgr: np.ndarray) -> float:
    h, w = candidate_bgr.shape[:2]
    if colorby_bgr.shape[:2] != (h, w):
        colorby_bgr = cv2.resize(colorby_bgr, (w, h), interpolation=cv2.INTER_AREA)
    cand_lab = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    cb_lab = cv2.cvtColor(colorby_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_mae = float(np.mean(np.abs(cand_lab - cb_lab)) / 255.0)

    cand_y = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    cb_y = cv2.cvtColor(colorby_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    y_mae = float(np.mean(np.abs(cand_y - cb_y)) / 255.0)
    y_ssim = float(structural_similarity(cand_y, cb_y, data_range=255))
    return float(0.58 * lab_mae + 0.27 * y_mae + 0.15 * (1.0 - y_ssim))


def main() -> int:
    args = parse_args()
    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(args.pairs_csv, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise RuntimeError("pairs csv is empty")

    per_method: Dict[str, List[float]] = {m: [] for m in methods}
    per_pair_rows = []

    for row in rows:
        pair_id = (row.get("pair_id") or row.get("name") or "").strip() or "pair"
        ref_path = (row.get("reference_path") or row.get("reference") or "").strip()
        src_path = (row.get("source_path") or row.get("source") or "").strip()
        cb_path = (row.get("colorby_path") or row.get("colorby_output") or "").strip()
        if not (Path(ref_path).is_file() and Path(src_path).is_file() and Path(cb_path).is_file()):
            continue

        ref = _read_bgr(ref_path)
        src = _read_bgr(src_path)
        cb = _read_bgr(cb_path)

        rec = {"pair_id": pair_id}
        for method in methods:
            transferred = run_transfer(
                method,
                src,
                ref,
                cinematic_enhance=True,
                cinematic_strength=args.cinematic_strength,
            )
            if bool(args.use_auto_xy):
                c, t, _ = recommend_xy_strength(src, ref, transferred)
            else:
                c, t = float(args.color_strength), float(args.tone_strength)

            output = blend_xy_strength(
                source_bgr=src,
                transferred_bgr=transferred,
                color_strength=c,
                tone_strength=t,
                skin_protect=bool(args.skin_protect),
                skin_strength=args.skin_strength,
                semantic_regions=bool(args.semantic_regions),
            )
            dist = _distance_to_colorby(output, cb)
            per_method[method].append(dist)
            rec[f"dist_{method}"] = dist
        per_pair_rows.append(rec)

    summary = []
    for method in methods:
        arr = per_method.get(method, [])
        if not arr:
            continue
        summary.append(
            {
                "method": method,
                "count": len(arr),
                "avg_distance_to_colorby": float(np.mean(arr)),
                "p90_distance_to_colorby": float(np.percentile(arr, 90)),
            }
        )
    summary.sort(key=lambda x: x["avg_distance_to_colorby"])

    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (out_dir / "per_pair.json").write_text(json.dumps(per_pair_rows, indent=2), encoding="utf-8")

    md = [
        "# Colorby Pair Evaluation",
        "",
        f"- Pair count: {len(per_pair_rows)}",
        f"- Use auto XY: {bool(args.use_auto_xy)}",
        f"- Cinematic strength: {args.cinematic_strength}",
        "",
        "| Rank | Method | Avg Distance | P90 Distance |",
        "|---|---|---:|---:|",
    ]
    for i, s in enumerate(summary, start=1):
        md.append(
            f"| {i} | {s['method']} | {s['avg_distance_to_colorby']:.5f} | {s['p90_distance_to_colorby']:.5f} |"
        )
    (out_dir / "summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"saved {out_dir / 'summary.json'}")
    print(f"saved {out_dir / 'summary.md'}")
    print(f"saved {out_dir / 'per_pair.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
