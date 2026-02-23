from __future__ import annotations

from pathlib import Path
from typing import Optional

import colour
import cv2
import numpy as np


def _cube_index(rgb_01: np.ndarray, cube_size: int) -> np.ndarray:
    q = np.clip(np.rint(rgb_01 * (cube_size - 1)), 0, cube_size - 1).astype(np.int32)
    return q[:, 0] * (cube_size * cube_size) + q[:, 1] * cube_size + q[:, 2]


def fit_lut_from_pair(
    source_bgr: np.ndarray,
    output_bgr: np.ndarray,
    cube_size: int = 33,
    sample_pixels: int = 80000,
) -> colour.LUT3D:
    src = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32) / 255.0
    out = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32) / 255.0

    n = src.shape[0]
    if n > sample_pixels:
        rng = np.random.default_rng(42)
        idx = rng.choice(n, sample_pixels, replace=False)
        src = src[idx]
        out = out[idx]

    bins = cube_size**3
    sums = np.zeros((bins, 3), dtype=np.float32)
    counts = np.zeros((bins,), dtype=np.int32)

    flat_idx = _cube_index(src, cube_size)
    np.add.at(sums, flat_idx, out)
    np.add.at(counts, flat_idx, 1)

    axis = np.linspace(0.0, 1.0, cube_size, dtype=np.float32)
    rr, gg, bb = np.meshgrid(axis, axis, axis, indexing="ij")
    identity = np.stack([rr, gg, bb], axis=-1).reshape(-1, 3)

    table = identity.copy()
    valid = counts > 0
    if np.any(valid):
        table[valid] = sums[valid] / counts[valid, None]

    table = table.reshape(cube_size, cube_size, cube_size, 3)
    return colour.LUT3D(table=np.clip(table, 0.0, 1.0), name=f"kinolu_{cube_size}")


def write_cube(lut: colour.LUT3D, cube_path: Path) -> None:
    cube_path.parent.mkdir(parents=True, exist_ok=True)
    colour.write_LUT(lut, str(cube_path))


def load_lut(cube_path: Path) -> Optional[object]:
    if not cube_path.exists():
        return None
    try:
        return colour.read_LUT(str(cube_path))
    except Exception:
        return None


def apply_lut_to_bgr(image_bgr: np.ndarray, lut: object) -> np.ndarray:
    src_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    out_rgb = np.clip(lut.apply(src_rgb), 0.0, 1.0)
    return cv2.cvtColor((out_rgb * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)
