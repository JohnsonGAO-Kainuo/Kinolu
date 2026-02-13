from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from backend.processing import (
    EditParams,
    apply_micro_edits,
    blend_xy_strength,
    recommend_xy_strength,
    run_transfer_with_meta,
    runtime_capabilities,
)


BASE_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="Kinolu Demo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decode_upload(data: bytes, label: str) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail=f"Invalid image: {label}")
    return image


def _parse_curve_points(raw: str):
    if not raw:
        return {"master": None, "r": None, "g": None, "b": None}
    try:
        data = json.loads(raw)
    except Exception:
        return {"master": None, "r": None, "g": None, "b": None}

    def parse_points(seq):
        if not isinstance(seq, list):
            return None
        points = []
        for item in seq:
            if not isinstance(item, (list, tuple)) or len(item) != 2:
                continue
            x, y = item
            try:
                points.append((float(x), float(y)))
            except Exception:
                continue
        return points if len(points) >= 2 else None

    # Backward compatible: single master list.
    if isinstance(data, list):
        return {"master": parse_points(data), "r": None, "g": None, "b": None}

    if not isinstance(data, dict):
        return {"master": None, "r": None, "g": None, "b": None}

    return {
        "master": parse_points(data.get("master")),
        "r": parse_points(data.get("r")),
        "g": parse_points(data.get("g")),
        "b": parse_points(data.get("b")),
    }


def _parse_hsl7_json(raw: str):
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return data


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/capabilities")
def capabilities():
    return runtime_capabilities()


@app.post("/api/transfer")
async def transfer(
    reference: UploadFile = File(...),
    source: UploadFile = File(...),
    method: str = Form("reinhard_lab"),
    cinematic_enhance: int = Form(1),
    cinematic_strength: float = Form(72.0),
    color_strength: float = Form(88.0),
    tone_strength: float = Form(78.0),
    auto_xy: int = Form(1),
    skin_protect: int = Form(0),
    skin_strength: float = Form(70.0),
    semantic_regions: int = Form(1),
    sat: float = Form(0.0),
    vib: float = Form(0.0),
    temp: float = Form(0.0),
    tint: float = Form(0.0),
    contrast: float = Form(0.0),
    highlights: float = Form(0.0),
    shadows: float = Form(0.0),
    grain: float = Form(0.0),
    sharpen: float = Form(0.0),
    curve: float = Form(0.0),
    curve_points: str = Form(""),
    hue: float = Form(0.0),
    hsl_sat: float = Form(0.0),
    hsl_light: float = Form(0.0),
    hsl7_json: str = Form(""),
):
    ref_bytes = await reference.read()
    src_bytes = await source.read()
    if not ref_bytes or not src_bytes:
        raise HTTPException(status_code=400, detail="Both images are required")

    reference_bgr = _decode_upload(ref_bytes, "reference")
    source_bgr = _decode_upload(src_bytes, "source")

    try:
        transferred, transfer_meta = run_transfer_with_meta(
            method,
            source_bgr,
            reference_bgr,
            cinematic_enhance=bool(cinematic_enhance),
            cinematic_strength=cinematic_strength,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transfer failed: {exc}") from exc

    xy_mode = "manual"
    xy_meta = {}
    used_color_strength = float(color_strength)
    used_tone_strength = float(tone_strength)
    if bool(auto_xy):
        used_color_strength, used_tone_strength, xy_meta = recommend_xy_strength(
            source_bgr=source_bgr,
            reference_bgr=reference_bgr,
            transferred_bgr=transferred,
        )
        xy_mode = "auto"

    blended = blend_xy_strength(
        source_bgr=source_bgr,
        transferred_bgr=transferred,
        color_strength=used_color_strength,
        tone_strength=used_tone_strength,
        skin_protect=bool(skin_protect),
        skin_strength=skin_strength,
        semantic_regions=bool(semantic_regions),
    )

    curve_payload = _parse_curve_points(curve_points)
    edited = apply_micro_edits(
        blended,
        EditParams(
            sat=sat,
            vib=vib,
            temp=temp,
            tint=tint,
            contrast=contrast,
            highlights=highlights,
            shadows=shadows,
            grain=grain,
            sharpen=sharpen,
            curve=curve,
            curve_points=curve_payload["master"],
            curve_points_r=curve_payload["r"],
            curve_points_g=curve_payload["g"],
            curve_points_b=curve_payload["b"],
            hue=hue,
            hsl_sat=hsl_sat,
            hsl_light=hsl_light,
            hsl7=_parse_hsl7_json(hsl7_json),
        ),
    )

    ok, encoded = cv2.imencode(".jpg", edited, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise HTTPException(status_code=500, detail="JPEG encoding failed")
    headers = {
        "X-Kinolu-Requested-Method": str(transfer_meta.get("requested_method", method)),
        "X-Kinolu-Selected-Method": str(transfer_meta.get("selected_method", method)),
        "X-Kinolu-Cinematic-Enhance": str(int(bool(cinematic_enhance))),
        "X-Kinolu-Cinematic-Strength": f"{float(cinematic_strength):.2f}",
        "X-Kinolu-XY-Mode": xy_mode,
        "X-Kinolu-Color-Strength-Used": f"{used_color_strength:.2f}",
        "X-Kinolu-Tone-Strength-Used": f"{used_tone_strength:.2f}",
    }
    if xy_meta:
        headers["X-Kinolu-XY-Meta"] = ",".join(
            [
                f"cg:{float(xy_meta.get('chroma_gap', 0.0)):.3f}",
                f"tg:{float(xy_meta.get('tone_gap', 0.0)):.3f}",
                f"fr:{float(xy_meta.get('face_ratio', 0.0)):.3f}",
            ]
        )
    ranked = transfer_meta.get("ranked_methods") or []
    if ranked:
        headers["X-Kinolu-Auto-Ranking"] = ",".join(
            f"{x['method']}:{float(x['overall_score']):.4f}" for x in ranked
        )[:800]
    return Response(content=encoded.tobytes(), media_type="image/jpeg", headers=headers)


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
