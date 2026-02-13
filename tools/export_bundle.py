#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import cv2
import colour
import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processing import EditParams, apply_micro_edits, blend_xy_strength, run_transfer


def parse_args():
    p = argparse.ArgumentParser(description="Export consistency bundle: preview + LUT + XMP + report.")
    p.add_argument("--reference", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--method", default="hybrid_auto")
    p.add_argument("--out-dir", default="out/export_bundle")
    p.add_argument("--cube-size", type=int, default=33)
    p.add_argument("--sample-pixels", type=int, default=60000)
    p.add_argument("--color-strength", type=float, default=95.0)
    p.add_argument("--tone-strength", type=float, default=90.0)
    p.add_argument("--skin-protect", type=int, default=0)
    p.add_argument("--skin-strength", type=float, default=70.0)
    p.add_argument("--semantic-regions", type=int, default=1)
    p.add_argument("--sat", type=float, default=0.0)
    p.add_argument("--vib", type=float, default=0.0)
    p.add_argument("--temp", type=float, default=0.0)
    p.add_argument("--tint", type=float, default=0.0)
    p.add_argument("--contrast", type=float, default=0.0)
    p.add_argument("--highlights", type=float, default=0.0)
    p.add_argument("--shadows", type=float, default=0.0)
    p.add_argument("--grain", type=float, default=0.0)
    p.add_argument("--sharpen", type=float, default=0.0)
    p.add_argument("--hue", type=float, default=0.0)
    p.add_argument("--hsl-sat", type=float, default=0.0)
    p.add_argument("--hsl-light", type=float, default=0.0)
    p.add_argument("--curve-points", default="[[0,0],[0.25,0.25],[0.5,0.5],[0.75,0.75],[1,1]]")
    p.add_argument("--emit-dng", type=int, default=1, help="Emit synthetic DNG via PiDNG if available")
    return p.parse_args()


def read_image(path: str):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"cannot read image: {path}")
    return img


def parse_curve_points(text: str):
    try:
        data = json.loads(text)
    except Exception:
        return None
    if not isinstance(data, list):
        return None
    out = []
    for p in data:
        if isinstance(p, (list, tuple)) and len(p) == 2:
            out.append((float(p[0]), float(p[1])))
    return out if len(out) >= 2 else None


def pipeline(args, source_bgr, reference_bgr):
    transferred = run_transfer(args.method, source_bgr, reference_bgr)
    blended = blend_xy_strength(
        source_bgr=source_bgr,
        transferred_bgr=transferred,
        color_strength=args.color_strength,
        tone_strength=args.tone_strength,
        skin_protect=bool(args.skin_protect),
        skin_strength=args.skin_strength,
        semantic_regions=bool(args.semantic_regions),
    )
    edits = EditParams(
        sat=args.sat,
        vib=args.vib,
        temp=args.temp,
        tint=args.tint,
        contrast=args.contrast,
        highlights=args.highlights,
        shadows=args.shadows,
        grain=args.grain,
        sharpen=args.sharpen,
        curve_points=parse_curve_points(args.curve_points),
        hue=args.hue,
        hsl_sat=args.hsl_sat,
        hsl_light=args.hsl_light,
    )
    return apply_micro_edits(blended, edits), edits


def fit_lut_from_pair(source_bgr: np.ndarray, output_bgr: np.ndarray, cube_size: int, sample_pixels: int):
    src = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32) / 255.0
    out = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32) / 255.0

    n = src.shape[0]
    if n > sample_pixels:
        rng = np.random.default_rng(42)
        idx = rng.choice(n, sample_pixels, replace=False)
        src_s = src[idx]
        out_s = out[idx]
    else:
        src_s, out_s = src, out

    tree = cKDTree(src_s)
    axis = np.linspace(0.0, 1.0, cube_size, dtype=np.float32)
    rr, gg, bb = np.meshgrid(axis, axis, axis, indexing="ij")
    grid = np.stack([rr, gg, bb], axis=-1).reshape(-1, 3)

    _, nn = tree.query(grid, k=1)
    table = np.clip(out_s[nn], 0.0, 1.0).reshape(cube_size, cube_size, cube_size, 3)
    return colour.LUT3D(table=table, name=f"kinolu_{cube_size}")


def write_xmp(path: Path, args, edits: EditParams):
    curve_points = parse_curve_points(args.curve_points) or []
    curve_flat = ", ".join([f"{x:.4f}, {y:.4f}" for x, y in curve_points])

    xmp = f"""<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      rdf:about=""
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      xmlns:kinolu="https://kinolu.app/xmp/1.0/"
      crs:Version="15.0"
      crs:ProcessVersion="11.0"
      crs:Contrast2012="{args.contrast:.2f}"
      crs:Highlights2012="{args.highlights:.2f}"
      crs:Shadows2012="{args.shadows:.2f}"
      crs:Saturation="{args.sat:.2f}"
      crs:Temperature="{args.temp:.2f}"
      crs:Tint="{args.tint:.2f}"
      kinolu:Method="{args.method}"
      kinolu:ColorStrength="{args.color_strength:.2f}"
      kinolu:ToneStrength="{args.tone_strength:.2f}"
      kinolu:SkinProtect="{int(args.skin_protect)}"
      kinolu:SkinStrength="{args.skin_strength:.2f}"
      kinolu:SemanticRegions="{int(args.semantic_regions)}"
      kinolu:Vibrance="{args.vib:.2f}"
      kinolu:Hue="{args.hue:.2f}"
      kinolu:HSLSat="{args.hsl_sat:.2f}"
      kinolu:HSLLight="{args.hsl_light:.2f}"
      kinolu:CurvePoints="{curve_flat}"
    />
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""
    path.write_text(xmp, encoding="utf-8")


def _bgr_to_rggb_u16(image_bgr: np.ndarray) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    if h < 2 or w < 2:
        raise RuntimeError("image too small for Bayer conversion")
    if h % 2 == 1:
        image_bgr = image_bgr[:-1, :, :]
        h -= 1
    if w % 2 == 1:
        image_bgr = image_bgr[:, :-1, :]
        w -= 1

    rgb_u16 = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB).astype(np.uint16) * 257
    raw = np.zeros((h, w), dtype=np.uint16)
    raw[0::2, 0::2] = rgb_u16[0::2, 0::2, 0]  # R
    raw[0::2, 1::2] = rgb_u16[0::2, 1::2, 1]  # G
    raw[1::2, 0::2] = rgb_u16[1::2, 0::2, 1]  # G
    raw[1::2, 1::2] = rgb_u16[1::2, 1::2, 2]  # B
    return raw


def write_dng(path: Path, image_bgr: np.ndarray) -> str:
    try:
        from pidng.core import RAW2DNG
        from pidng.defs import CFAPattern, CalibrationIlluminant, Orientation, PhotometricInterpretation
        from pidng.dng import DNGTags, Tag
    except Exception as exc:
        return f"pidng import failed: {exc}"

    try:
        raw = _bgr_to_rggb_u16(image_bgr)
        h, w = raw.shape[:2]
        tags = DNGTags()
        tags.set(Tag.ImageWidth, int(w))
        tags.set(Tag.ImageLength, int(h))
        tags.set(Tag.TileWidth, int(w))
        tags.set(Tag.TileLength, int(h))
        tags.set(Tag.Orientation, Orientation.Horizontal)
        tags.set(Tag.PhotometricInterpretation, PhotometricInterpretation.Color_Filter_Array)
        tags.set(Tag.SamplesPerPixel, 1)
        tags.set(Tag.BitsPerSample, 16)
        tags.set(Tag.CFARepeatPatternDim, [2, 2])
        tags.set(Tag.CFAPattern, CFAPattern.RGGB)
        tags.set(Tag.BlackLevelRepeatDim, [2, 2])
        tags.set(Tag.BlackLevel, [0, 0, 0, 0])
        tags.set(Tag.WhiteLevel, 65535)
        tags.set(Tag.CalibrationIlluminant1, CalibrationIlluminant.D65)
        tags.set(Tag.ColorMatrix1, [[1, 1], [0, 1], [0, 1], [0, 1], [1, 1], [0, 1], [0, 1], [0, 1], [1, 1]])
        tags.set(Tag.AsShotNeutral, [[1, 1], [1, 1], [1, 1]])
        tags.set(Tag.Make, "Kinolu")
        tags.set(Tag.Model, "Kinolu Synthetic DNG")
        tags.set(Tag.ProfileName, "Kinolu Synthetic RGGB")

        conv = RAW2DNG()
        conv.options(tags, str(path.parent), compress=False)
        out_path = conv.convert(raw, filename=path.stem)
        if not out_path:
            return "pidng convert returned empty path"
        return ""
    except Exception as exc:
        return f"pidng export failed: {exc}"


def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ref = read_image(args.reference)
    src = read_image(args.source)
    preview, edits = pipeline(args, src, ref)
    preview_path = out_dir / "preview.jpg"
    cv2.imwrite(str(preview_path), preview, [int(cv2.IMWRITE_JPEG_QUALITY), 95])

    lut = fit_lut_from_pair(src, preview, cube_size=args.cube_size, sample_pixels=args.sample_pixels)
    cube_path = out_dir / f"look_{args.cube_size}.cube"
    colour.write_LUT(lut, str(cube_path))

    xmp_path = out_dir / "look.xmp"
    write_xmp(xmp_path, args, edits)

    dng_path = out_dir / "look.dng"
    dng_error = ""
    if int(args.emit_dng) == 1:
        dng_error = write_dng(dng_path, preview)

    src_rgb = cv2.cvtColor(src, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    lut_rgb = np.clip(lut.apply(src_rgb), 0.0, 1.0)
    lut_bgr = cv2.cvtColor((lut_rgb * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)
    lut_preview_path = out_dir / "preview_from_lut.jpg"
    cv2.imwrite(str(lut_preview_path), lut_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])

    mae = float(np.mean(np.abs(preview.astype(np.float32) - lut_bgr.astype(np.float32))))
    report = {
        "preview": str(preview_path),
        "cube": str(cube_path),
        "xmp": str(xmp_path),
        "dng": str(dng_path) if dng_error == "" else "",
        "dng_error": dng_error,
        "preview_from_lut": str(lut_preview_path),
        "lut_preview_mae_0_255": mae,
        "notes": [
            "LUT is fitted from source->preview correspondence for consistency on similar images.",
            "Local/semantic operations are approximated in 3D LUT space and may not be exact on arbitrary images.",
            "DNG is emitted as synthetic Bayer DNG for workflow testing; verify in target RAW editor.",
        ],
    }
    report_path = out_dir / "export_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"saved {preview_path}")
    print(f"saved {cube_path}")
    print(f"saved {xmp_path}")
    if dng_error == "":
        print(f"saved {dng_path}")
    else:
        print(f"dng skipped: {dng_error}")
    print(f"saved {lut_preview_path}")
    print(f"saved {report_path}")


if __name__ == "__main__":
    main()
