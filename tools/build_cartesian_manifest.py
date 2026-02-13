#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import List


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build full cartesian pair manifest from references.csv and targets.csv.")
    p.add_argument("--references-csv", required=True, help="CSV with local_path column")
    p.add_argument("--targets-csv", required=True, help="CSV with local_path column")
    p.add_argument("--out-csv", required=True, help="Output manifest CSV")
    return p.parse_args()


def _load_local_paths(path: Path) -> List[str]:
    with path.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return []
    out = []
    for row in rows:
        lp = (row.get("local_path") or "").strip()
        if lp:
            out.append(lp)
    return out


def main() -> int:
    args = parse_args()
    references = _load_local_paths(Path(args.references_csv))
    targets = _load_local_paths(Path(args.targets_csv))
    if not references or not targets:
        raise RuntimeError("references/targets are empty or missing local_path column")

    out_csv = Path(args.out_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for i, ref in enumerate(references, start=1):
        for j, src in enumerate(targets, start=1):
            rows.append(
                {
                    "name": f"ref{i:03d}_to_tgt{j:03d}",
                    "reference": ref,
                    "source": src,
                }
            )

    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "reference", "source"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"references={len(references)} targets={len(targets)} pairs={len(rows)}")
    print(f"saved {out_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
