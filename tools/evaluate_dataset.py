#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
import sys
from typing import Dict, Iterable, List

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import (
    EditParams,
    apply_micro_edits,
    blend_xy_strength,
    compute_quality_metrics,
    run_transfer,
)

METHODS_DEFAULT = ["auto_best", "hybrid_auto", "reinhard_lab", "reinhard", "lhm"]


def _safe_tag(text: str, max_len: int = 28) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", str(text or "")).strip("-").lower()
    if not slug:
        return "x"
    return slug[:max_len].strip("-") or "x"


def parse_args():
    p = argparse.ArgumentParser(description="Systematic dataset quality evaluation for color transfer methods.")
    p.add_argument("--manifest", required=True, help="CSV with columns: reference,source,name(optional)")
    p.add_argument("--out-dir", default="out/eval_dataset", help="Output directory")
    p.add_argument("--methods", default=",".join(METHODS_DEFAULT), help="Comma-separated methods")
    p.add_argument("--save-images", action="store_true", help="Save method outputs per pair")
    p.add_argument("--color-strength", type=float, default=95.0)
    p.add_argument("--tone-strength", type=float, default=90.0)
    p.add_argument("--skin-protect", type=int, default=0)
    p.add_argument("--skin-strength", type=float, default=70.0)
    p.add_argument("--semantic-regions", type=int, default=1)
    return p.parse_args()


def load_manifest(path: Path) -> List[Dict[str, str]]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if "reference" not in row or "source" not in row:
                raise ValueError("Manifest must contain columns: reference,source")
            name = row.get("name") or f"pair_{i:04d}"
            rows.append({"name": name, "reference": row["reference"], "source": row["source"]})
    if not rows:
        raise ValueError("Manifest is empty")
    return rows


def read_image(path: str):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read image: {path}")
    return img


def main():
    args = parse_args()
    manifest = load_manifest(Path(args.manifest))
    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.save_images:
        (out_dir / "images").mkdir(parents=True, exist_ok=True)

    rows = []
    for pair in manifest:
        ref = read_image(pair["reference"])
        src = read_image(pair["source"])
        for method in methods:
            transferred = run_transfer(method, src, ref)
            blended = blend_xy_strength(
                source_bgr=src,
                transferred_bgr=transferred,
                color_strength=args.color_strength,
                tone_strength=args.tone_strength,
                skin_protect=bool(args.skin_protect),
                skin_strength=args.skin_strength,
                semantic_regions=bool(args.semantic_regions),
            )
            output = apply_micro_edits(blended, EditParams())
            metrics = compute_quality_metrics(output, src, ref)
            rec = {"pair": pair["name"], "method": method, **metrics}
            rows.append(rec)

            if args.save_images:
                safe_pair = _safe_tag(pair["name"], max_len=24)
                ref_tag = _safe_tag(Path(pair["reference"]).stem, max_len=24)
                src_tag = _safe_tag(Path(pair["source"]).stem, max_len=24)
                out_name = f"{safe_pair}__ref-{ref_tag}__src-{src_tag}__{method}.jpg"
                cv2.imwrite(
                    str(out_dir / "images" / out_name),
                    output,
                    [int(cv2.IMWRITE_JPEG_QUALITY), 95],
                )

    # Raw results
    raw_path = out_dir / "results.json"
    raw_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    # Aggregate method ranking
    agg = {}
    for r in rows:
        m = r["method"]
        agg.setdefault(m, {"count": 0, "overall_score": 0.0, "face_drift": 0.0, "luma_ssim": 0.0})
        agg[m]["count"] += 1
        agg[m]["overall_score"] += r["overall_score"]
        agg[m]["face_drift"] += r["face_drift"]
        agg[m]["luma_ssim"] += r["luma_ssim"]

    summary = []
    for m, v in agg.items():
        c = max(v["count"], 1)
        summary.append(
            {
                "method": m,
                "count": c,
                "avg_overall_score": v["overall_score"] / c,
                "avg_face_drift": v["face_drift"] / c,
                "avg_luma_ssim": v["luma_ssim"] / c,
            }
        )
    summary.sort(key=lambda x: x["avg_overall_score"])

    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md = ["# Dataset Evaluation Summary", "", "| Rank | Method | Avg Score (lower better) | Avg Face Drift | Avg Luma SSIM |", "|---|---|---:|---:|---:|"]
    for i, s in enumerate(summary, start=1):
        md.append(
            f"| {i} | {s['method']} | {s['avg_overall_score']:.4f} | {s['avg_face_drift']:.4f} | {s['avg_luma_ssim']:.4f} |"
        )
    (out_dir / "summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"saved {raw_path}")
    print(f"saved {out_dir / 'summary.json'}")
    print(f"saved {out_dir / 'summary.md'}")


if __name__ == "__main__":
    main()
