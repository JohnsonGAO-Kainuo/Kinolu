#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys
from typing import Dict, List

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import compute_quality_metrics


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Compare Kinolu outputs against Colorby outputs on the same reference/source pairs."
    )
    p.add_argument(
        "--pairs-csv",
        required=True,
        help="CSV with columns: name,reference,source,colorby_output and one our_* column",
    )
    p.add_argument(
        "--our-column",
        default="our_reinhard_lab",
        help="Column name used as Kinolu output path (default: our_reinhard_lab)",
    )
    p.add_argument("--out-dir", default="out/compare_colorby_batch", help="Output directory")
    return p.parse_args()


def _read_image(path: str):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read image: {path}")
    return img


def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return float("inf")


def main() -> int:
    args = parse_args()
    pairs_path = Path(args.pairs_csv)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows: List[Dict] = []
    with pairs_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            ref_path = (row.get("reference") or "").strip()
            src_path = (row.get("source") or "").strip()
            our_path = (row.get(args.our_column) or "").strip()
            colorby_path = (row.get("colorby_output") or "").strip()

            if not (name and ref_path and src_path and our_path and colorby_path):
                continue
            if not (Path(ref_path).is_file() and Path(src_path).is_file() and Path(our_path).is_file() and Path(colorby_path).is_file()):
                continue

            ref = _read_image(ref_path)
            src = _read_image(src_path)
            our = _read_image(our_path)
            colorby = _read_image(colorby_path)

            our_metrics = compute_quality_metrics(our, src, ref)
            cb_metrics = compute_quality_metrics(colorby, src, ref)

            our_score = _safe_float(our_metrics.get("overall_score"))
            cb_score = _safe_float(cb_metrics.get("overall_score"))
            winner = "tie"
            if our_score < cb_score:
                winner = "kinolu"
            elif cb_score < our_score:
                winner = "colorby"

            rows.append(
                {
                    "name": name,
                    "our_column": args.our_column,
                    "our_path": our_path,
                    "colorby_path": colorby_path,
                    "kinolu_overall_score": our_score,
                    "colorby_overall_score": cb_score,
                    "delta_colorby_minus_kinolu": cb_score - our_score,
                    "winner": winner,
                }
            )

    if not rows:
        raise RuntimeError("No valid comparable rows found. Fill colorby_output paths first.")

    kinolu_wins = sum(1 for r in rows if r["winner"] == "kinolu")
    colorby_wins = sum(1 for r in rows if r["winner"] == "colorby")
    ties = sum(1 for r in rows if r["winner"] == "tie")
    n = len(rows)
    kinolu_avg = sum(r["kinolu_overall_score"] for r in rows) / n
    colorby_avg = sum(r["colorby_overall_score"] for r in rows) / n

    summary = {
        "pairs_csv": str(pairs_path.resolve()),
        "our_column": args.our_column,
        "count": n,
        "kinolu_avg_overall_score": kinolu_avg,
        "colorby_avg_overall_score": colorby_avg,
        "kinolu_wins": kinolu_wins,
        "colorby_wins": colorby_wins,
        "ties": ties,
    }

    (out_dir / "results.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md = [
        "# Kinolu vs Colorby",
        "",
        f"- Pairs: {n}",
        f"- Kinolu avg score (lower better): {kinolu_avg:.4f}",
        f"- Colorby avg score (lower better): {colorby_avg:.4f}",
        f"- Wins: Kinolu {kinolu_wins} / Colorby {colorby_wins} / Tie {ties}",
        "",
        "| Pair | Kinolu Score | Colorby Score | Delta (colorby-kinolu) | Winner |",
        "|---|---:|---:|---:|---|",
    ]
    for r in rows:
        md.append(
            f"| {r['name']} | {r['kinolu_overall_score']:.4f} | {r['colorby_overall_score']:.4f} | "
            f"{r['delta_colorby_minus_kinolu']:.4f} | {r['winner']} |"
        )

    (out_dir / "summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"saved {out_dir / 'results.json'}")
    print(f"saved {out_dir / 'summary.json'}")
    print(f"saved {out_dir / 'summary.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
