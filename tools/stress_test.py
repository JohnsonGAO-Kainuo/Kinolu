#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import statistics
import sys
import time
from typing import Dict, List

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import EditParams, apply_micro_edits, blend_xy_strength, run_transfer


def parse_args():
    p = argparse.ArgumentParser(description="Batch/stability stress test over resolutions and scenes.")
    p.add_argument("--manifest", required=True, help="CSV with columns: reference,source,name(optional)")
    p.add_argument("--out-dir", default="out/stress_test")
    p.add_argument("--methods", default="hybrid_auto,reinhard_lab")
    p.add_argument("--resolutions", default="512,768,1024,1536,2048")
    p.add_argument("--iterations", type=int, default=1)
    p.add_argument("--skin-protect", type=int, default=0)
    p.add_argument("--skin-strength", type=float, default=70.0)
    p.add_argument("--semantic-regions", type=int, default=1)
    p.add_argument("--color-strength", type=float, default=95.0)
    p.add_argument("--tone-strength", type=float, default=90.0)
    return p.parse_args()


def load_manifest(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            rows.append(
                {
                    "name": row.get("name") or f"pair_{i:04d}",
                    "reference": row["reference"],
                    "source": row["source"],
                }
            )
    if not rows:
        raise RuntimeError("manifest empty")
    return rows


def read_image(path: str):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"cannot read image: {path}")
    return img


def resize_long_side(image, long_side: int):
    h, w = image.shape[:2]
    scale = long_side / max(h, w)
    nh, nw = int(round(h * scale)), int(round(w * scale))
    return cv2.resize(image, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)


def main():
    args = parse_args()
    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    resolutions = [int(x.strip()) for x in args.resolutions.split(",") if x.strip()]
    manifest = load_manifest(Path(args.manifest))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    records: List[Dict] = []
    failures: List[Dict] = []

    for pair in manifest:
        ref_full = read_image(pair["reference"])
        src_full = read_image(pair["source"])
        for res in resolutions:
            ref = resize_long_side(ref_full, res)
            src = resize_long_side(src_full, res)
            for method in methods:
                times = []
                ok = True
                err = ""
                for _ in range(max(1, args.iterations)):
                    t0 = time.perf_counter()
                    try:
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
                        _ = apply_micro_edits(blended, EditParams())
                    except Exception as exc:
                        ok = False
                        err = str(exc)
                        break
                    times.append(time.perf_counter() - t0)

                rec = {
                    "pair": pair["name"],
                    "method": method,
                    "resolution_long_side": res,
                    "ok": ok,
                    "runs": len(times),
                    "avg_sec": float(statistics.mean(times)) if times else None,
                    "p95_sec": float(max(times)) if times else None,
                    "error": err,
                }
                records.append(rec)
                if not ok:
                    failures.append(rec)

    (out_dir / "stress_results.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (out_dir / "stress_failures.json").write_text(json.dumps(failures, indent=2), encoding="utf-8")

    # Aggregate summary by method/resolution
    grouped: Dict[str, List[float]] = {}
    for r in records:
        if not r["ok"] or r["avg_sec"] is None:
            continue
        key = f"{r['method']}@{r['resolution_long_side']}"
        grouped.setdefault(key, []).append(r["avg_sec"])

    summary = []
    for key, vals in grouped.items():
        method, res = key.split("@")
        summary.append(
            {
                "method": method,
                "resolution_long_side": int(res),
                "count": len(vals),
                "avg_sec": float(statistics.mean(vals)),
                "max_sec": float(max(vals)),
            }
        )
    summary.sort(key=lambda x: (x["method"], x["resolution_long_side"]))
    (out_dir / "stress_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md = ["# Stress Test Summary", "", "| Method | Long Side | Count | Avg Sec | Max Sec |", "|---|---:|---:|---:|---:|"]
    for s in summary:
        md.append(
            f"| {s['method']} | {s['resolution_long_side']} | {s['count']} | {s['avg_sec']:.3f} | {s['max_sec']:.3f} |"
        )
    md.append("")
    md.append(f"Failures: {len(failures)}")
    (out_dir / "stress_summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"saved {out_dir / 'stress_results.json'}")
    print(f"saved {out_dir / 'stress_summary.json'}")
    print(f"saved {out_dir / 'stress_summary.md'}")
    print(f"failures {len(failures)}")


if __name__ == "__main__":
    main()
