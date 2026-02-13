#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
from skimage.metrics import structural_similarity

import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import blend_xy_strength, run_transfer


VALID_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class PairItem:
    pair_id: str
    ref_index: int
    tgt_index: int
    reference_path: str
    source_path: str
    colorby_path: str
    match_score: float


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Map Colorby folder outputs and analyze/tune Kinolu against them.")
    p.add_argument("--cb-root", default="CB", help="Folder containing refXX_targetY groups")
    p.add_argument("--references-csv", default="datasets/openverse_stocksnap_photo_v2/references.csv")
    p.add_argument("--targets-csv", default="datasets/openverse_stocksnap_photo_v2/targets.csv")
    p.add_argument("--ref-count", type=int, default=6)
    p.add_argument("--target-count", type=int, default=9)
    p.add_argument("--methods", default="reinhard_lab,hybrid_auto,reinhard,lhm")
    p.add_argument("--out-dir", default="out/analyze_colorby_cb")
    p.add_argument("--color-grid", default="88,94,100")
    p.add_argument("--tone-grid", default="78,88,98")
    p.add_argument("--cine-grid", default="60,72,84")
    p.add_argument("--semantic-regions", type=int, default=1)
    p.add_argument("--skin-protect", type=int, default=0)
    p.add_argument("--skin-strength", type=float, default=70.0)
    return p.parse_args()


def _load_csv_rows(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _read_bgr(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read image: {path}")
    return img


def _gray_u8(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)


def _ssim_gray(a_bgr: np.ndarray, b_bgr: np.ndarray) -> float:
    h, w = a_bgr.shape[:2]
    if b_bgr.shape[:2] != (h, w):
        b_bgr = cv2.resize(b_bgr, (w, h), interpolation=cv2.INTER_AREA)
    a = _gray_u8(a_bgr)
    b = _gray_u8(b_bgr)
    return float(structural_similarity(a, b, data_range=255))


def _pair_distance_to_colorby(candidate_bgr: np.ndarray, colorby_bgr: np.ndarray) -> float:
    h, w = candidate_bgr.shape[:2]
    if colorby_bgr.shape[:2] != (h, w):
        colorby_bgr = cv2.resize(colorby_bgr, (w, h), interpolation=cv2.INTER_AREA)

    cand_lab = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    cb_lab = cv2.cvtColor(colorby_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_mae = float(np.mean(np.abs(cand_lab - cb_lab)) / 255.0)

    cand_y = _gray_u8(candidate_bgr).astype(np.float32)
    cb_y = _gray_u8(colorby_bgr).astype(np.float32)
    y_mae = float(np.mean(np.abs(cand_y - cb_y)) / 255.0)
    y_ssim = float(structural_similarity(cand_y, cb_y, data_range=255))

    # Lower is better.
    return float(0.58 * lab_mae + 0.27 * y_mae + 0.15 * (1.0 - y_ssim))


def _tone_stats(image_bgr: np.ndarray) -> Dict[str, float]:
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l = lab[:, :, 0] / 255.0
    p5, p50, p95 = np.percentile(l, [5, 50, 95]).astype(np.float32)
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    sat = float(np.mean(hsv[:, :, 1] / 255.0))
    return {
        "l_p5": float(p5),
        "l_p50": float(p50),
        "l_p95": float(p95),
        "l_std": float(np.std(l)),
        "sat_mean": sat,
    }


def _dp_best_assignment(score_matrix: np.ndarray) -> List[int]:
    n_rows, n_cols = score_matrix.shape
    if n_rows == 0 or n_cols == 0:
        return []
    if n_rows > n_cols:
        raise ValueError("Need at least as many target candidates as cb images")

    # DP over bitmask for max-sum one-to-one assignment.
    best_score = {0: 0.0}
    parent: Dict[Tuple[int, int], Tuple[int, int]] = {}
    for i in range(n_rows):
        nxt: Dict[int, float] = {}
        for mask, cur in best_score.items():
            for j in range(n_cols):
                if mask & (1 << j):
                    continue
                m2 = mask | (1 << j)
                val = cur + float(score_matrix[i, j])
                old = nxt.get(m2)
                if old is None or val > old:
                    nxt[m2] = val
                    parent[(i + 1, m2)] = (mask, j)
        best_score = nxt

    # Backtrack best mask at row=n_rows
    final_mask = max(best_score, key=lambda m: best_score[m])
    assignment = [-1] * n_rows
    row = n_rows
    mask = final_mask
    while row > 0:
        prev_mask, col = parent[(row, mask)]
        assignment[row - 1] = col
        row -= 1
        mask = prev_mask
    return assignment


def _parse_ref_index(dirname: str) -> int:
    m = re.search(r"ref\s*0*([0-9]+)", dirname.lower())
    if not m:
        return -1
    return int(m.group(1))


def _list_group_images(group_dir: Path) -> List[Path]:
    files = []
    for p in sorted(group_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in VALID_IMAGE_SUFFIXES:
            continue
        files.append(p)
    return files


def build_pairs(
    cb_root: Path,
    references: List[Dict[str, str]],
    targets: List[Dict[str, str]],
    ref_count: int,
    target_count: int,
) -> List[PairItem]:
    ref_rows = references[:ref_count]
    tgt_rows = targets[:target_count]
    tgt_imgs = [_read_bgr(r["local_path"]) for r in tgt_rows]

    pairs: List[PairItem] = []
    for group_dir in sorted([p for p in cb_root.iterdir() if p.is_dir()]):
        ref_idx = _parse_ref_index(group_dir.name)
        if ref_idx < 1 or ref_idx > len(ref_rows):
            continue
        cb_files = _list_group_images(group_dir)
        if not cb_files:
            continue

        cb_imgs = [_read_bgr(str(p)) for p in cb_files]
        score = np.zeros((len(cb_imgs), len(tgt_imgs)), dtype=np.float32)
        for i, cb in enumerate(cb_imgs):
            for j, tgt in enumerate(tgt_imgs):
                score[i, j] = _ssim_gray(cb, tgt)
        assign = _dp_best_assignment(score)

        for i, tgt_j in enumerate(assign):
            tgt_idx = tgt_j + 1
            pair_id = f"ref{ref_idx:02d}_to_tgt{tgt_idx:02d}"
            pairs.append(
                PairItem(
                    pair_id=pair_id,
                    ref_index=ref_idx,
                    tgt_index=tgt_idx,
                    reference_path=ref_rows[ref_idx - 1]["local_path"],
                    source_path=tgt_rows[tgt_idx - 1]["local_path"],
                    colorby_path=str(cb_files[i].resolve()),
                    match_score=float(score[i, tgt_j]),
                )
            )
    pairs.sort(key=lambda x: (x.ref_index, x.tgt_index))
    return pairs


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    references = _load_csv_rows(Path(args.references_csv))
    targets = _load_csv_rows(Path(args.targets_csv))
    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    color_grid = [float(x) for x in args.color_grid.split(",") if x.strip()]
    tone_grid = [float(x) for x in args.tone_grid.split(",") if x.strip()]
    cine_grid = [float(x) for x in args.cine_grid.split(",") if x.strip()]

    pairs = build_pairs(
        cb_root=Path(args.cb_root),
        references=references,
        targets=targets,
        ref_count=args.ref_count,
        target_count=args.target_count,
    )
    if not pairs:
        raise RuntimeError("No valid Colorby pairs found")

    # Save matched mapping first for transparency.
    mapping_csv = out_dir / "matched_pairs.csv"
    with mapping_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "pair_id",
                "ref_index",
                "tgt_index",
                "reference_path",
                "source_path",
                "colorby_path",
                "match_score",
            ],
        )
        writer.writeheader()
        for p in pairs:
            writer.writerow(
                {
                    "pair_id": p.pair_id,
                    "ref_index": p.ref_index,
                    "tgt_index": p.tgt_index,
                    "reference_path": p.reference_path,
                    "source_path": p.source_path,
                    "colorby_path": p.colorby_path,
                    "match_score": f"{p.match_score:.6f}",
                }
            )

    # Cache source/ref/colorby images.
    ref_cache: Dict[str, np.ndarray] = {}
    src_cache: Dict[str, np.ndarray] = {}
    cb_cache: Dict[str, np.ndarray] = {}
    for p in pairs:
        if p.reference_path not in ref_cache:
            ref_cache[p.reference_path] = _read_bgr(p.reference_path)
        if p.source_path not in src_cache:
            src_cache[p.source_path] = _read_bgr(p.source_path)
        if p.colorby_path not in cb_cache:
            cb_cache[p.colorby_path] = _read_bgr(p.colorby_path)

    # Method ranking against Colorby.
    method_scores = {m: [] for m in methods}
    pair_rows = []
    for p in pairs:
        ref = ref_cache[p.reference_path]
        src = src_cache[p.source_path]
        cb = cb_cache[p.colorby_path]

        mrow = {"pair_id": p.pair_id, "ref_index": p.ref_index, "tgt_index": p.tgt_index}
        best_method = ""
        best_dist = float("inf")
        for m in methods:
            out = run_transfer(m, src, ref, cinematic_enhance=True, cinematic_strength=72.0)
            out = blend_xy_strength(
                source_bgr=src,
                transferred_bgr=out,
                color_strength=100.0,
                tone_strength=100.0,
                skin_protect=bool(args.skin_protect),
                skin_strength=args.skin_strength,
                semantic_regions=bool(args.semantic_regions),
            )
            dist = _pair_distance_to_colorby(out, cb)
            method_scores[m].append(dist)
            mrow[f"dist_{m}"] = dist
            if dist < best_dist:
                best_dist = dist
                best_method = m
        mrow["best_method"] = best_method
        mrow["best_dist"] = best_dist
        pair_rows.append(mrow)

    method_summary = []
    for m in methods:
        arr = method_scores[m]
        method_summary.append(
            {
                "method": m,
                "count": len(arr),
                "avg_distance_to_colorby": float(np.mean(arr)),
                "p90_distance_to_colorby": float(np.percentile(arr, 90)),
            }
        )
    method_summary.sort(key=lambda x: x["avg_distance_to_colorby"])

    # Global tuning for reinhard_lab only.
    # Cache transfer output by (pair_id, cine_strength), then apply XY blending grids.
    transfer_cache: Dict[Tuple[str, float], np.ndarray] = {}
    baseline_dists = []
    for p in pairs:
        ref = ref_cache[p.reference_path]
        src = src_cache[p.source_path]
        cb = cb_cache[p.colorby_path]
        base = run_transfer("reinhard_lab", src, ref, cinematic_enhance=True, cinematic_strength=72.0)
        blend = blend_xy_strength(
            source_bgr=src,
            transferred_bgr=base,
            color_strength=100.0,
            tone_strength=100.0,
            skin_protect=bool(args.skin_protect),
            skin_strength=args.skin_strength,
            semantic_regions=bool(args.semantic_regions),
        )
        baseline_dists.append(_pair_distance_to_colorby(blend, cb))

    grid_rows = []
    best_cfg = None
    best_cfg_score = float("inf")
    for cine in cine_grid:
        for p in pairs:
            key = (p.pair_id, cine)
            if key in transfer_cache:
                continue
            ref = ref_cache[p.reference_path]
            src = src_cache[p.source_path]
            transfer_cache[key] = run_transfer("reinhard_lab", src, ref, cinematic_enhance=True, cinematic_strength=cine)

        for cs in color_grid:
            for ts in tone_grid:
                dists = []
                for p in pairs:
                    src = src_cache[p.source_path]
                    cb = cb_cache[p.colorby_path]
                    base = transfer_cache[(p.pair_id, cine)]
                    out = blend_xy_strength(
                        source_bgr=src,
                        transferred_bgr=base,
                        color_strength=cs,
                        tone_strength=ts,
                        skin_protect=bool(args.skin_protect),
                        skin_strength=args.skin_strength,
                        semantic_regions=bool(args.semantic_regions),
                    )
                    dists.append(_pair_distance_to_colorby(out, cb))
                avgd = float(np.mean(dists))
                row = {
                    "color_strength": cs,
                    "tone_strength": ts,
                    "cinematic_strength": cine,
                    "avg_distance_to_colorby": avgd,
                    "p90_distance_to_colorby": float(np.percentile(dists, 90)),
                }
                grid_rows.append(row)
                if avgd < best_cfg_score:
                    best_cfg_score = avgd
                    best_cfg = row

    grid_rows.sort(key=lambda x: x["avg_distance_to_colorby"])
    baseline_avg = float(np.mean(baseline_dists))

    # Characteristic deltas vs source.
    cb_deltas = []
    kinolu_deltas = []
    if best_cfg is None:
        raise RuntimeError("No tuning result")
    for p in pairs:
        src = src_cache[p.source_path]
        cb = cb_cache[p.colorby_path]
        ref = ref_cache[p.reference_path]

        src_s = _tone_stats(src)
        cb_s = _tone_stats(cb)

        tuned_base = transfer_cache[(p.pair_id, best_cfg["cinematic_strength"])]
        tuned = blend_xy_strength(
            source_bgr=src,
            transferred_bgr=tuned_base,
            color_strength=best_cfg["color_strength"],
            tone_strength=best_cfg["tone_strength"],
            skin_protect=bool(args.skin_protect),
            skin_strength=args.skin_strength,
            semantic_regions=bool(args.semantic_regions),
        )
        kn_s = _tone_stats(tuned)

        cb_deltas.append(
            {
                "d_p5": cb_s["l_p5"] - src_s["l_p5"],
                "d_p50": cb_s["l_p50"] - src_s["l_p50"],
                "d_p95": cb_s["l_p95"] - src_s["l_p95"],
                "d_std": cb_s["l_std"] - src_s["l_std"],
                "d_sat": cb_s["sat_mean"] - src_s["sat_mean"],
            }
        )
        kinolu_deltas.append(
            {
                "d_p5": kn_s["l_p5"] - src_s["l_p5"],
                "d_p50": kn_s["l_p50"] - src_s["l_p50"],
                "d_p95": kn_s["l_p95"] - src_s["l_p95"],
                "d_std": kn_s["l_std"] - src_s["l_std"],
                "d_sat": kn_s["sat_mean"] - src_s["sat_mean"],
            }
        )

    def avg_delta(rows: List[Dict[str, float]]) -> Dict[str, float]:
        keys = ["d_p5", "d_p50", "d_p95", "d_std", "d_sat"]
        return {k: float(np.mean([r[k] for r in rows])) for k in keys}

    report = {
        "pair_count": len(pairs),
        "mapping_csv": str(mapping_csv.resolve()),
        "method_summary": method_summary,
        "baseline_reinhard_lab_default": {
            "color_strength": 100.0,
            "tone_strength": 100.0,
            "cinematic_strength": 72.0,
            "avg_distance_to_colorby": baseline_avg,
        },
        "best_reinhard_lab_tuned": best_cfg,
        "improvement_vs_baseline": {
            "avg_distance_delta": float(best_cfg["avg_distance_to_colorby"] - baseline_avg),
            "relative": float((best_cfg["avg_distance_to_colorby"] - baseline_avg) / max(1e-9, baseline_avg)),
        },
        "tone_delta_source_to_colorby_avg": avg_delta(cb_deltas),
        "tone_delta_source_to_kinolu_tuned_avg": avg_delta(kinolu_deltas),
    }

    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_dir / "method_distances.json").write_text(json.dumps(pair_rows, indent=2), encoding="utf-8")
    (out_dir / "reinhard_tuning_grid.json").write_text(json.dumps(grid_rows, indent=2), encoding="utf-8")

    md = [
        "# Colorby CB Folder Analysis",
        "",
        f"- Pairs analyzed: {len(pairs)}",
        f"- Mapping file: `{mapping_csv}`",
        "",
        "## Method Ranking (distance to Colorby, lower better)",
        "",
        "| Rank | Method | Avg Distance | P90 Distance |",
        "|---|---|---:|---:|",
    ]
    for i, row in enumerate(method_summary, start=1):
        md.append(
            f"| {i} | {row['method']} | {row['avg_distance_to_colorby']:.5f} | {row['p90_distance_to_colorby']:.5f} |"
        )
    md += [
        "",
        "## Reinhard Lab Tuning",
        "",
        f"- Baseline (100/100/72) avg distance: {baseline_avg:.5f}",
        (
            f"- Best config: color={best_cfg['color_strength']:.1f}, "
            f"tone={best_cfg['tone_strength']:.1f}, cine={best_cfg['cinematic_strength']:.1f}, "
            f"avg distance={best_cfg['avg_distance_to_colorby']:.5f}"
        ),
        "",
        "## Tone Signature (avg delta vs source)",
        "",
        f"- Colorby: {report['tone_delta_source_to_colorby_avg']}",
        f"- Kinolu tuned: {report['tone_delta_source_to_kinolu_tuned_avg']}",
        "",
    ]
    (out_dir / "report.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"saved {out_dir / 'report.json'}")
    print(f"saved {out_dir / 'report.md'}")
    print(f"saved {out_dir / 'matched_pairs.csv'}")
    print(f"saved {out_dir / 'reinhard_tuning_grid.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
