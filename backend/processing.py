from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Callable, Dict, List, Optional, Tuple

import cv2
import colour
import numpy as np
from skimage.exposure import adjust_sigmoid, match_histograms
from skimage.metrics import structural_similarity

from colortrans import transfer_lhm, transfer_pccm, transfer_reinhard
from color_transfer import color_transfer as lab_reinhard

try:
    import mediapipe as mp
except Exception:  # pragma: no cover - optional runtime fallback
    mp = None
try:
    import torch
except Exception:  # pragma: no cover - optional runtime fallback
    torch = None


_SEGMENTER = None
_FACE_DETECTOR = None
_MOBILE_SAM_PREDICTOR = None
_MOBILE_SAM_INIT_DONE = False
_MOBILE_SAM_ERROR = ""

# Keep PCCM available for backward compatibility, but exclude it from default/public ranking
# because it is unstable on many real-world photo pairs.
AUTO_BEST_CANDIDATES = ("hybrid_auto", "reinhard_lab", "reinhard", "lhm")
PUBLIC_METHODS = ("auto_best", "hybrid_auto", "reinhard_lab", "reinhard", "lhm")
HSL7_BANDS = ("red", "orange", "yellow", "green", "aqua", "blue", "purple")
HSL7_CENTERS = {
    "red": 0.0,
    "orange": 30.0,
    "yellow": 60.0,
    "green": 120.0,
    "aqua": 180.0,
    "blue": 240.0,
    "purple": 300.0,
}
HSL7_BAND_WIDTH_DEG = 42.0

# Learned from local Colorby benchmark batch (54 pairs in `CB/`).
# We use these as a gentle calibration prior, not a hard override.
COLORBY_SIGNATURE = {
    "l_p5_shift": -0.02244,
    "l_p50_shift": -0.04793,
    "l_p95_shift": -0.00690,
    "sat_shift": 0.00949,
}


@dataclass
class EditParams:
    sat: float = 0.0
    vib: float = 0.0
    temp: float = 0.0
    tint: float = 0.0
    contrast: float = 0.0
    highlights: float = 0.0
    shadows: float = 0.0
    grain: float = 0.0
    sharpen: float = 0.0
    curve: float = 0.0
    curve_points: Optional[List[Tuple[float, float]]] = None
    curve_points_r: Optional[List[Tuple[float, float]]] = None
    curve_points_g: Optional[List[Tuple[float, float]]] = None
    curve_points_b: Optional[List[Tuple[float, float]]] = None
    hue: float = 0.0
    hsl_sat: float = 0.0
    hsl_light: float = 0.0
    hsl7: Optional[Dict[str, Dict[str, float]]] = None


def _get_segmenter():
    global _SEGMENTER
    if _SEGMENTER is not None:
        return _SEGMENTER
    if mp is None:
        return None
    try:
        _SEGMENTER = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    except Exception:
        _SEGMENTER = None
    return _SEGMENTER


def _get_face_detector():
    global _FACE_DETECTOR
    if _FACE_DETECTOR is not None:
        return _FACE_DETECTOR
    if mp is None:
        return None
    try:
        _FACE_DETECTOR = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.45)
    except Exception:
        _FACE_DETECTOR = None
    return _FACE_DETECTOR


def _get_mobile_sam_predictor():
    global _MOBILE_SAM_PREDICTOR, _MOBILE_SAM_INIT_DONE, _MOBILE_SAM_ERROR
    if _MOBILE_SAM_INIT_DONE:
        return _MOBILE_SAM_PREDICTOR

    _MOBILE_SAM_INIT_DONE = True
    _MOBILE_SAM_PREDICTOR = None
    _MOBILE_SAM_ERROR = ""

    if torch is None:
        _MOBILE_SAM_ERROR = "torch unavailable"
        return None

    checkpoint = os.getenv("MOBILE_SAM_CHECKPOINT", "models/mobile_sam.pt")
    if not os.path.isfile(checkpoint):
        _MOBILE_SAM_ERROR = f"checkpoint missing: {checkpoint}"
        return None

    model_type = os.getenv("MOBILE_SAM_MODEL", "vit_t")
    try:
        from mobile_sam import SamPredictor, sam_model_registry
    except Exception as exc:  # pragma: no cover
        _MOBILE_SAM_ERROR = f"import failed: {exc}"
        return None

    if model_type not in sam_model_registry:
        _MOBILE_SAM_ERROR = f"invalid model type: {model_type}"
        return None

    try:
        device = "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu"
        sam_model = sam_model_registry[model_type](checkpoint=checkpoint)
        sam_model.to(device=device)
        sam_model.eval()
        _MOBILE_SAM_PREDICTOR = SamPredictor(sam_model)
    except Exception as exc:  # pragma: no cover
        _MOBILE_SAM_ERROR = f"init failed: {exc}"
        _MOBILE_SAM_PREDICTOR = None
    return _MOBILE_SAM_PREDICTOR


def runtime_capabilities() -> dict:
    predictor = _get_mobile_sam_predictor()
    return {
        "mediapipe": mp is not None,
        "mobile_sam_enabled": predictor is not None,
        "mobile_sam_error": _MOBILE_SAM_ERROR,
        "mobile_sam_checkpoint": os.getenv("MOBILE_SAM_CHECKPOINT", "models/mobile_sam.pt"),
        "methods": list(PUBLIC_METHODS),
    }


def _to_rgb(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def _to_bgr(image_rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)


def _transfer_with_colortrans(
    source_bgr: np.ndarray, reference_bgr: np.ndarray, fn: Callable[[np.ndarray, np.ndarray], np.ndarray]
) -> np.ndarray:
    source_rgb = _to_rgb(source_bgr)
    reference_rgb = _to_rgb(reference_bgr)
    out_rgb = fn(source_rgb, reference_rgb)
    return _to_bgr(out_rgb)


def _normalize_method(method: str) -> str:
    m = str(method or "").strip().lower()
    aliases = {
        "auto-best": "auto_best",
        "autobest": "auto_best",
        "auto best": "auto_best",
        "hybrid": "hybrid_auto",
    }
    return aliases.get(m, m)


def _score_style_fit(candidate_bgr: np.ndarray, source_bgr: np.ndarray, reference_bgr: np.ndarray) -> float:
    cand_lab = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(reference_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    cand_mean = cand_lab.reshape(-1, 3).mean(axis=0)
    cand_std = cand_lab.reshape(-1, 3).std(axis=0) + 1e-6
    ref_mean = ref_lab.reshape(-1, 3).mean(axis=0)
    ref_std = ref_lab.reshape(-1, 3).std(axis=0) + 1e-6

    chroma_style = np.mean(np.abs(cand_mean[1:] - ref_mean[1:]) / 64.0)
    chroma_std = np.mean(np.abs(cand_std[1:] - ref_std[1:]) / 64.0)
    luma_style = np.abs(cand_mean[0] - ref_mean[0]) / 64.0

    # Keep some source structure to avoid over-shifted/unnatural portraits.
    luma_structure = np.mean(np.abs(cand_lab[:, :, 0] - src_lab[:, :, 0])) / 255.0

    face_penalty = 0.0
    face = _face_priority_mask(source_bgr)
    if face.max() > 0:
        src_ycc = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2YCrCb).astype(np.float32)
        cand_ycc = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2YCrCb).astype(np.float32)
        w = np.clip(face, 0.0, 1.0)
        w_sum = float(w.sum())
        if w_sum > 10:
            src_cr = float((src_ycc[:, :, 1] * w).sum() / w_sum)
            src_cb = float((src_ycc[:, :, 2] * w).sum() / w_sum)
            cand_cr = float((cand_ycc[:, :, 1] * w).sum() / w_sum)
            cand_cb = float((cand_ycc[:, :, 2] * w).sum() / w_sum)
            face_penalty = (abs(cand_cr - src_cr) + abs(cand_cb - src_cb)) / 255.0

    return float(chroma_style + chroma_std + 0.35 * luma_style + 0.45 * luma_structure + 0.7 * face_penalty)


def _refine_chroma_hist(candidate_bgr: np.ndarray, reference_bgr: np.ndarray, amount: float = 0.28) -> np.ndarray:
    amount = float(np.clip(amount, 0.0, 1.0))
    if amount <= 0.0:
        return candidate_bgr

    cand_lab = cv2.cvtColor(candidate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(reference_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    cand_ab = np.clip(cand_lab[:, :, 1:3] / 255.0, 0.0, 1.0)
    ref_ab = np.clip(ref_lab[:, :, 1:3] / 255.0, 0.0, 1.0)
    matched_ab = match_histograms(cand_ab, ref_ab, channel_axis=-1)
    blended_ab = (1.0 - amount) * cand_ab + amount * np.clip(matched_ab, 0.0, 1.0)

    cand_lab[:, :, 1:3] = np.clip(blended_ab * 255.0, 0.0, 255.0)
    return cv2.cvtColor(cand_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def _monotonic_clip(values: np.ndarray, eps: float = 1e-4) -> np.ndarray:
    out = values.astype(np.float32).copy()
    out[0] = float(np.clip(out[0], 0.0, 1.0))
    for i in range(1, out.shape[0]):
        out[i] = max(out[i], out[i - 1] + eps)
    return np.clip(out, 0.0, 1.0)


def _piecewise_tone_map(luma: np.ndarray, src_pts: np.ndarray, dst_pts: np.ndarray) -> np.ndarray:
    x = _monotonic_clip(src_pts)
    y = _monotonic_clip(dst_pts)
    return np.interp(luma, x, y).astype(np.float32)


def _apply_colorby_signature_calibration(
    source_bgr: np.ndarray,
    output_bgr: np.ndarray,
    color_strength: float,
    tone_strength: float,
) -> np.ndarray:
    # Only apply at meaningful blend strengths.
    if color_strength < 40.0 and tone_strength < 40.0:
        return output_bgr

    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    out_lab = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    src_l = src_lab[:, :, 0] / 255.0
    out_l = out_lab[:, :, 0] / 255.0

    src_p = np.percentile(src_l, [5, 50, 95]).astype(np.float32)
    out_p = np.percentile(out_l, [5, 50, 95]).astype(np.float32)
    sig = COLORBY_SIGNATURE
    target_p = np.array(
        [
            np.clip(src_p[0] + sig["l_p5_shift"], 0.0, 1.0),
            np.clip(src_p[1] + sig["l_p50_shift"], 0.0, 1.0),
            np.clip(src_p[2] + sig["l_p95_shift"], 0.0, 1.0),
        ],
        dtype=np.float32,
    )

    tone_w = np.clip(tone_strength / 100.0, 0.0, 1.0)
    # Increase correction when output tone is far from learned target.
    tone_mismatch = float(np.mean(np.abs(out_p - target_p)))
    corr_w = float(np.clip(0.24 + 2.2 * tone_mismatch, 0.22, 0.68) * (0.45 + 0.55 * tone_w))
    goal_p = (1.0 - corr_w) * out_p + corr_w * target_p

    x = np.array([0.0, out_p[0], out_p[1], out_p[2], 1.0], dtype=np.float32)
    y = np.array([0.0, goal_p[0], goal_p[1], goal_p[2], 1.0], dtype=np.float32)
    out_l2 = _piecewise_tone_map(out_l, x, y)
    out_lab[:, :, 0] = np.clip(out_l2 * 255.0, 0.0, 255.0)
    out_bgr = cv2.cvtColor(out_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

    # Match global saturation drift to learned Colorby tendency.
    src_hsv = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    out_hsv = cv2.cvtColor(out_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    src_sat = float(np.mean(src_hsv[:, :, 1] / 255.0))
    out_sat = float(np.mean(out_hsv[:, :, 1] / 255.0))
    sat_target = float(np.clip(src_sat + sig["sat_shift"], 0.0, 1.0))

    color_w = np.clip(color_strength / 100.0, 0.0, 1.0)
    sat_w = float(np.clip(0.20 + 0.55 * color_w, 0.20, 0.75))
    sat_goal = (1.0 - sat_w) * out_sat + sat_w * sat_target
    sat_gain = float(np.clip((sat_goal + 1e-6) / (out_sat + 1e-6), 0.90, 1.10))
    out_hsv[:, :, 1] = np.clip(out_hsv[:, :, 1] * sat_gain, 0.0, 255.0)
    return cv2.cvtColor(out_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def _apply_cinematic_tone_enhancement(
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    image_bgr: np.ndarray,
    strength: float = 72.0,
) -> np.ndarray:
    s = float(np.clip(strength / 100.0, 0.0, 1.0))
    if s <= 0.0:
        return image_bgr

    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(reference_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    out_lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    src_l = src_lab[:, :, 0] / 255.0
    ref_l = ref_lab[:, :, 0] / 255.0
    l = out_lab[:, :, 0] / 255.0

    p_img = np.percentile(l, [5, 50, 95]).astype(np.float32)
    p_src = np.percentile(src_l, [5, 50, 95]).astype(np.float32)
    p_ref = np.percentile(ref_l, [5, 50, 95]).astype(np.float32)

    w_ref = 0.46 * s
    w_src = 0.20 * s
    w_img = max(0.0, 1.0 - w_ref - w_src)
    p_target = w_img * p_img + w_ref * p_ref + w_src * p_src
    # Guard rails: avoid flat highlights when reference/source are bright.
    highlight_floor = 0.88 * max(float(p_src[2]), float(p_ref[2]))
    p_target[2] = max(float(p_target[2]), highlight_floor)
    p_target[1] = np.clip(float(p_target[1]), 0.10, p_target[2] - 0.05)
    p_target[0] = min(float(p_target[0]), p_target[1] - 0.03)

    # Anchor points for percentile remapping.
    x = np.array([0.0, p_img[0], p_img[1], p_img[2], 1.0], dtype=np.float32)
    y = np.array([0.0, p_target[0], p_target[1], p_target[2], 1.0], dtype=np.float32)
    l = _piecewise_tone_map(l, x, y)

    # Film-like toe lift (softer blacks) and highlight shoulder (gentler rolloff).
    shadow_mask = np.clip((0.42 - l) / 0.42, 0.0, 1.0)
    l = l + (shadow_mask**1.6) * (0.085 * s)
    highlight_mask = np.clip((l - 0.72) / 0.28, 0.0, 1.0)
    l = l - (highlight_mask**1.4) * (0.025 * s)

    # Midtone local contrast, keeps texture/film depth without oversharpening edges.
    blur = cv2.GaussianBlur(l, (0, 0), sigmaX=1.2, sigmaY=1.2)
    detail = l - blur
    mid_mask = np.clip(1.0 - np.abs(l - 0.5) / 0.5, 0.0, 1.0)
    l = np.clip(l + detail * (0.75 * s) * mid_mask, 0.0, 1.0)

    # Subtle luma unsharp for film texture presence.
    l_u8 = np.clip(l * 255.0, 0.0, 255.0).astype(np.uint8)
    l_blur = cv2.GaussianBlur(l_u8, (0, 0), sigmaX=1.4, sigmaY=1.4)
    l_u8 = cv2.addWeighted(l_u8, 1.0 + 0.28 * s, l_blur, -0.28 * s, 0)
    l = np.clip(l_u8.astype(np.float32) / 255.0, 0.0, 1.0)

    out_lab[:, :, 0] = np.clip(l * 255.0, 0.0, 255.0)
    out_bgr = cv2.cvtColor(out_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

    # Subtle global saturation density toward reference, avoids flat digital look.
    out_hsv = cv2.cvtColor(out_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    ref_hsv = cv2.cvtColor(reference_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    sat_out = float(np.mean(out_hsv[:, :, 1] / 255.0))
    sat_ref = float(np.mean(ref_hsv[:, :, 1] / 255.0))
    sat_target = sat_out * (1.0 - 0.35 * s) + sat_ref * (0.35 * s)
    sat_gain = float(np.clip((sat_target + 1e-6) / (sat_out + 1e-6), 0.88, 1.18))
    out_hsv[:, :, 1] = np.clip(out_hsv[:, :, 1] * sat_gain, 0.0, 255.0)
    return cv2.cvtColor(out_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def _run_transfer_core(
    method: str,
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    cinematic_enhance: bool = True,
    cinematic_strength: float = 72.0,
) -> np.ndarray:
    if method == "hybrid_auto":
        candidates = [
            lab_reinhard(reference_bgr, source_bgr, clip=True, preserve_paper=False),
            _transfer_with_colortrans(source_bgr, reference_bgr, transfer_reinhard),
            _transfer_with_colortrans(source_bgr, reference_bgr, transfer_lhm),
        ]
        refined = [_refine_chroma_hist(c, reference_bgr) for c in candidates]
        scores = [_score_style_fit(c, source_bgr, reference_bgr) for c in refined]
        out = refined[int(np.argmin(scores))]
    elif method == "reinhard_lab":
        base = lab_reinhard(reference_bgr, source_bgr, clip=True, preserve_paper=False)
        out = _refine_chroma_hist(base, reference_bgr, amount=0.18)
    elif method == "reinhard":
        out = _transfer_with_colortrans(source_bgr, reference_bgr, transfer_reinhard)
    elif method == "pccm":
        out = _transfer_with_colortrans(source_bgr, reference_bgr, transfer_pccm)
    elif method == "lhm":
        out = _transfer_with_colortrans(source_bgr, reference_bgr, transfer_lhm)
    else:
        raise ValueError(f"Unsupported method: {method}")

    if cinematic_enhance:
        out = _apply_cinematic_tone_enhancement(
            source_bgr=source_bgr,
            reference_bgr=reference_bgr,
            image_bgr=out,
            strength=cinematic_strength,
        )
    return out


def run_transfer_with_meta(
    method: str,
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    cinematic_enhance: bool = True,
    cinematic_strength: float = 72.0,
) -> tuple[np.ndarray, dict]:
    method = _normalize_method(method)
    if method != "auto_best":
        output = _run_transfer_core(
            method,
            source_bgr,
            reference_bgr,
            cinematic_enhance=cinematic_enhance,
            cinematic_strength=cinematic_strength,
        )
        return output, {
            "requested_method": method,
            "selected_method": method,
            "scores": {},
            "ranked_methods": [],
        }

    # Reuse source semantic masks across candidates for more consistent/faster scoring.
    source_masks = semantic_region_masks(source_bgr)
    best_method = ""
    best_output = None
    best_score = float("inf")
    details = {}

    for candidate in AUTO_BEST_CANDIDATES:
        output = _run_transfer_core(
            candidate,
            source_bgr,
            reference_bgr,
            cinematic_enhance=cinematic_enhance,
            cinematic_strength=cinematic_strength,
        )
        metrics = compute_quality_metrics(output, source_bgr, reference_bgr, source_masks=source_masks)
        score = float(metrics["overall_score"])
        details[candidate] = {
            "overall_score": score,
            "face_drift": float(metrics["face_drift"]),
            "luma_ssim": float(metrics["luma_ssim"]),
        }
        if score < best_score:
            best_score = score
            best_method = candidate
            best_output = output

    ranked = sorted(
        [{"method": k, "overall_score": v["overall_score"]} for k, v in details.items()],
        key=lambda x: x["overall_score"],
    )
    return best_output, {
        "requested_method": method,
        "selected_method": best_method,
        "scores": details,
        "ranked_methods": ranked,
    }


def run_transfer(
    method: str,
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    cinematic_enhance: bool = True,
    cinematic_strength: float = 72.0,
) -> np.ndarray:
    output, _ = run_transfer_with_meta(
        method,
        source_bgr,
        reference_bgr,
        cinematic_enhance=cinematic_enhance,
        cinematic_strength=cinematic_strength,
    )
    return output


def _person_mask_mediapipe(image_bgr: np.ndarray) -> np.ndarray:
    seg = _get_segmenter()
    if seg is None:
        return np.zeros(image_bgr.shape[:2], dtype=np.float32)
    rgb = _to_rgb(image_bgr)
    try:
        out = seg.process(rgb)
    except Exception:
        return np.zeros(image_bgr.shape[:2], dtype=np.float32)
    if out.segmentation_mask is None:
        return np.zeros(image_bgr.shape[:2], dtype=np.float32)
    mask = out.segmentation_mask.astype(np.float32)
    return np.clip(mask, 0.0, 1.0)


def _mobile_sam_subject_mask(image_bgr: np.ndarray, seed_mask: np.ndarray) -> np.ndarray:
    predictor = _get_mobile_sam_predictor()
    h, w = image_bgr.shape[:2]
    if predictor is None:
        return np.zeros((h, w), dtype=np.float32)

    ys, xs = np.where(seed_mask > 0.2)
    if len(xs) < 50:
        return np.zeros((h, w), dtype=np.float32)

    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    # slightly expanded ROI for subject edges
    padx = int((x1 - x0 + 1) * 0.08)
    pady = int((y1 - y0 + 1) * 0.08)
    x0 = max(0, x0 - padx)
    y0 = max(0, y0 - pady)
    x1 = min(w - 1, x1 + padx)
    y1 = min(h - 1, y1 + pady)

    point_x = float(xs.mean())
    point_y = float(ys.mean())
    box = np.array([x0, y0, x1, y1], dtype=np.float32)
    point_coords = np.array([[point_x, point_y]], dtype=np.float32)
    point_labels = np.array([1], dtype=np.int32)

    try:
        predictor.set_image(_to_rgb(image_bgr))
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            box=box,
            multimask_output=True,
        )
    except Exception:
        return np.zeros((h, w), dtype=np.float32)

    if masks is None or len(masks) == 0:
        return np.zeros((h, w), dtype=np.float32)

    idx = int(np.argmax(scores)) if scores is not None and len(scores) == len(masks) else 0
    mask = masks[idx].astype(np.float32)
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=4.0, sigmaY=4.0)
    return np.clip(mask, 0.0, 1.0)


def _face_priority_mask(image_bgr: np.ndarray) -> np.ndarray:
    detector = _get_face_detector()
    h, w = image_bgr.shape[:2]
    if detector is None:
        return np.zeros((h, w), dtype=np.float32)
    rgb = _to_rgb(image_bgr)
    try:
        result = detector.process(rgb)
    except Exception:
        return np.zeros((h, w), dtype=np.float32)
    if not result.detections:
        return np.zeros((h, w), dtype=np.float32)

    mask = np.zeros((h, w), dtype=np.float32)
    for det in result.detections:
        box = det.location_data.relative_bounding_box
        x = int(max(0, box.xmin * w))
        y = int(max(0, box.ymin * h))
        bw = int(max(1, box.width * w))
        bh = int(max(1, box.height * h))

        # expand to include cheeks and forehead for safer skin anchoring
        cx = x + bw // 2
        cy = y + bh // 2
        bw = int(bw * 1.25)
        bh = int(bh * 1.35)
        x0 = max(0, cx - bw // 2)
        y0 = max(0, cy - bh // 2)
        x1 = min(w, x0 + bw)
        y1 = min(h, y0 + bh)
        if x1 <= x0 or y1 <= y0:
            continue
        mask[y0:y1, x0:x1] = 1.0

    if mask.max() == 0:
        return mask
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=8.0, sigmaY=8.0)
    return np.clip(mask, 0.0, 1.0)


def _skin_mask(image_bgr: np.ndarray) -> np.ndarray:
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    skin1 = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127)) > 0
    skin2 = cv2.inRange(hsv, (0, 15, 40), (35, 220, 255)) > 0
    skin = (skin1 & skin2).astype(np.float32)

    person = _person_mask_mediapipe(image_bgr)
    face = _face_priority_mask(image_bgr)

    seed = np.maximum(person, face)
    sam_subject = _mobile_sam_subject_mask(image_bgr, seed)
    if sam_subject.max() > 0:
        person = np.maximum(person * 0.7, sam_subject)

    if person.max() > 0:
        skin *= (person > 0.25).astype(np.float32)

    if face.max() > 0:
        if person.max() > 0:
            face *= np.clip(person * 1.35, 0.0, 1.0)
        # face region gets stronger protection than threshold-only skin
        skin = np.maximum(skin * 0.75, face)

    skin = cv2.GaussianBlur(skin, (0, 0), sigmaX=3.0)
    return np.clip(skin, 0.0, 1.0)


def semantic_region_masks(image_bgr: np.ndarray) -> dict:
    h, w = image_bgr.shape[:2]
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    person = _person_mask_mediapipe(image_bgr)
    face = _face_priority_mask(image_bgr)
    seed = np.maximum(person, face)
    sam = _mobile_sam_subject_mask(image_bgr, seed)
    subject = np.maximum(person, sam) if sam.max() > 0 else person

    skin = _skin_mask(image_bgr)

    # Sky heuristic: top-prior + blue/cloud-like tones.
    y_idx = np.linspace(1.0, 0.0, h, dtype=np.float32)[:, None]
    top_prior = np.repeat(y_idx, w, axis=1) ** 1.8
    blue = (hsv[:, :, 0] >= 80) & (hsv[:, :, 0] <= 140) & (hsv[:, :, 1] >= 20) & (hsv[:, :, 2] >= 40)
    cloud = (hsv[:, :, 1] < 45) & (hsv[:, :, 2] > 135)
    sky = np.clip(top_prior * (0.75 * blue.astype(np.float32) + 0.35 * cloud.astype(np.float32)), 0.0, 1.0)

    # Vegetation heuristic.
    vegetation = (
        (hsv[:, :, 0] >= 28)
        & (hsv[:, :, 0] <= 95)
        & (hsv[:, :, 1] >= 35)
        & (hsv[:, :, 2] >= 30)
    ).astype(np.float32)

    # Architecture heuristic: neutral/low saturation + texture edges.
    low_sat = (hsv[:, :, 1] < 65).astype(np.float32)
    edges = cv2.Laplacian(gray, cv2.CV_32F)
    edges = np.abs(edges)
    edges = edges / (edges.max() + 1e-6)
    architecture = np.clip(low_sat * np.clip(edges * 2.2, 0.0, 1.0), 0.0, 1.0)

    # Exclusion and smoothing.
    if subject.max() > 0:
        sky *= (1.0 - np.clip(subject * 0.85, 0.0, 1.0))
        vegetation *= (1.0 - np.clip(subject * 0.8, 0.0, 1.0))
        architecture *= (1.0 - np.clip(subject * 0.9, 0.0, 1.0))
    sky = cv2.GaussianBlur(np.clip(sky, 0.0, 1.0), (0, 0), sigmaX=2.0)
    vegetation = cv2.GaussianBlur(np.clip(vegetation, 0.0, 1.0), (0, 0), sigmaX=2.0)
    architecture = cv2.GaussianBlur(np.clip(architecture, 0.0, 1.0), (0, 0), sigmaX=2.0)

    bg = np.clip(1.0 - np.clip(subject + sky + vegetation, 0.0, 1.0), 0.0, 1.0)
    return {
        "subject": np.clip(subject, 0.0, 1.0),
        "face": np.clip(face, 0.0, 1.0),
        "skin": np.clip(skin, 0.0, 1.0),
        "sky": sky,
        "vegetation": vegetation,
        "architecture": architecture,
        "background": bg,
    }


def _masked_mean_lab(image_bgr: np.ndarray, mask: np.ndarray) -> Optional[np.ndarray]:
    w = np.clip(mask, 0.0, 1.0).astype(np.float32)
    denom = float(w.sum())
    if denom < 5.0:
        return None
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    means = np.array([(lab[:, :, c] * w).sum() / denom for c in range(3)], dtype=np.float32)
    return means


def _masked_chroma_gap(a_bgr: np.ndarray, b_bgr: np.ndarray, mask: np.ndarray, scale: float = 64.0) -> float:
    if a_bgr.shape[:2] != mask.shape[:2]:
        a_bgr = cv2.resize(a_bgr, (mask.shape[1], mask.shape[0]), interpolation=cv2.INTER_AREA)
    if b_bgr.shape[:2] != mask.shape[:2]:
        b_bgr = cv2.resize(b_bgr, (mask.shape[1], mask.shape[0]), interpolation=cv2.INTER_AREA)
    ma = _masked_mean_lab(a_bgr, mask)
    mb = _masked_mean_lab(b_bgr, mask)
    if ma is None or mb is None:
        return 0.0
    return float(np.mean(np.abs(ma[1:] - mb[1:]) / scale))


def compute_quality_metrics(
    output_bgr: np.ndarray,
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    source_masks: Optional[dict] = None,
) -> dict:
    base = _score_style_fit(output_bgr, source_bgr, reference_bgr)
    masks = source_masks if source_masks is not None else semantic_region_masks(source_bgr)

    face_mask = masks["face"]
    if float(face_mask.sum()) < 5.0:
        face_mask = masks["skin"]
    face_drift = _masked_chroma_gap(output_bgr, source_bgr, face_mask, scale=40.0)
    skin_drift = _masked_chroma_gap(output_bgr, source_bgr, masks["skin"], scale=40.0)
    sky_style_gap = _masked_chroma_gap(output_bgr, reference_bgr, masks["sky"], scale=64.0)
    veg_style_gap = _masked_chroma_gap(output_bgr, reference_bgr, masks["vegetation"], scale=64.0)

    src_l = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32) / 255.0
    out_l = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32) / 255.0
    try:
        luma_ssim = float(structural_similarity(src_l, out_l, data_range=1.0))
    except Exception:
        luma_ssim = 0.0

    overall = (
        1.15 * base
        + 0.8 * face_drift
        + 0.35 * skin_drift
        + 0.35 * sky_style_gap
        + 0.25 * veg_style_gap
        + 0.3 * (1.0 - luma_ssim)
    )
    return {
        "overall_score": float(overall),
        "style_base": float(base),
        "face_drift": float(face_drift),
        "skin_drift": float(skin_drift),
        "sky_style_gap": float(sky_style_gap),
        "vegetation_style_gap": float(veg_style_gap),
        "luma_ssim": float(luma_ssim),
    }


def recommend_xy_strength(
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    transferred_bgr: Optional[np.ndarray] = None,
) -> tuple[float, float, dict]:
    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(reference_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    src_mean = src_lab.reshape(-1, 3).mean(axis=0)
    src_std = src_lab.reshape(-1, 3).std(axis=0) + 1e-6
    ref_mean = ref_lab.reshape(-1, 3).mean(axis=0)
    ref_std = ref_lab.reshape(-1, 3).std(axis=0) + 1e-6

    mean_diff = np.abs(src_mean - ref_mean)
    std_diff = np.abs(src_std - ref_std)

    chroma_gap = float(np.clip(np.mean(mean_diff[1:] / 48.0 + 0.35 * std_diff[1:] / 48.0), 0.0, 1.8))
    tone_gap = float(np.clip(mean_diff[0] / 52.0 + 0.35 * std_diff[0] / 52.0, 0.0, 1.8))

    # Base recommendation: larger source/reference gap -> slightly lower default blend.
    color_strength = 96.0 - 24.0 * min(chroma_gap, 1.2)
    tone_strength = 96.0 - 18.0 * min(tone_gap, 1.2)

    masks = semantic_region_masks(source_bgr)
    face_ratio = float((masks["face"] > 0.25).mean())
    skin_ratio = float((masks["skin"] > 0.25).mean())
    subject_ratio = float((masks["subject"] > 0.25).mean())

    # Portrait-heavy frames are more sensitive to over-transfer.
    color_strength -= 18.0 * min(face_ratio / 0.15, 1.0) * min(chroma_gap, 1.0)
    color_strength -= 8.0 * min(skin_ratio / 0.25, 1.0) * min(chroma_gap, 1.0)
    tone_strength -= 8.0 * min(subject_ratio / 0.45, 1.0) * min(tone_gap, 1.0)

    quality = None
    if transferred_bgr is not None:
        quality = compute_quality_metrics(
            output_bgr=transferred_bgr,
            source_bgr=source_bgr,
            reference_bgr=reference_bgr,
            source_masks=masks,
        )
        face_drift = float(quality["face_drift"])
        luma_ssim = float(quality["luma_ssim"])
        color_strength -= 22.0 * min(face_drift / 0.22, 1.0)
        tone_strength -= 10.0 * min((1.0 - luma_ssim) / 0.35, 1.0)

    color_strength = float(np.clip(color_strength, 45.0, 98.0))
    tone_strength = float(np.clip(tone_strength, 45.0, 98.0))
    meta = {
        "chroma_gap": chroma_gap,
        "tone_gap": tone_gap,
        "face_ratio": face_ratio,
        "skin_ratio": skin_ratio,
        "subject_ratio": subject_ratio,
    }
    if quality is not None:
        meta["quality"] = {
            "face_drift": float(quality["face_drift"]),
            "luma_ssim": float(quality["luma_ssim"]),
        }
    return color_strength, tone_strength, meta


def blend_xy_strength(
    source_bgr: np.ndarray,
    transferred_bgr: np.ndarray,
    color_strength: float,
    tone_strength: float,
    skin_protect: bool,
    skin_strength: float = 70.0,
    semantic_regions: bool = True,
) -> np.ndarray:
    x = np.clip(color_strength / 100.0, 0.0, 1.0)
    y = np.clip(tone_strength / 100.0, 0.0, 1.0)

    source_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    trans_lab = cv2.cvtColor(transferred_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    regions = semantic_region_masks(source_bgr) if semantic_regions else {
        "subject": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "face": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "skin": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "sky": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "vegetation": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "architecture": np.zeros(source_bgr.shape[:2], dtype=np.float32),
        "background": np.ones(source_bgr.shape[:2], dtype=np.float32),
    }

    l_alpha = np.full(source_bgr.shape[:2], y, dtype=np.float32)
    c_alpha = np.full(source_bgr.shape[:2], x, dtype=np.float32)
    c_alpha *= (1.0 - 0.22 * regions["subject"])
    l_alpha *= (1.0 - 0.12 * regions["subject"])
    c_alpha *= (1.0 - 0.15 * regions["sky"])
    l_alpha *= (1.0 - 0.05 * regions["sky"])
    c_alpha *= (1.0 - 0.20 * regions["vegetation"])

    skin = np.zeros(source_bgr.shape[:2], dtype=np.float32)
    if skin_protect:
        s = np.clip(skin_strength / 100.0, 0.0, 1.0)
        skin = regions["skin"]
        # tone can move a bit; chroma should stay much closer on skin
        l_alpha *= (1.0 - 0.35 * s * skin)
        c_alpha *= (1.0 - 0.90 * s * skin)

    out_lab = source_lab.copy()
    out_lab[:, :, 0] = source_lab[:, :, 0] * (1.0 - l_alpha) + trans_lab[:, :, 0] * l_alpha
    out_lab[:, :, 1] = source_lab[:, :, 1] * (1.0 - c_alpha) + trans_lab[:, :, 1] * c_alpha
    out_lab[:, :, 2] = source_lab[:, :, 2] * (1.0 - c_alpha) + trans_lab[:, :, 2] * c_alpha

    if skin_protect and skin.max() > 0:
        s = np.clip(skin_strength / 100.0, 0.0, 1.0)
        # hard cap chroma drift on skin to avoid odd face tint shifts
        delta_a = out_lab[:, :, 1] - source_lab[:, :, 1]
        delta_b = out_lab[:, :, 2] - source_lab[:, :, 2]
        limit_a = 20.0 - 10.0 * s
        limit_b = 24.0 - 12.0 * s
        clipped_a = np.clip(delta_a, -limit_a, limit_a)
        clipped_b = np.clip(delta_b, -limit_b, limit_b)
        out_lab[:, :, 1] = source_lab[:, :, 1] + (1.0 - skin) * delta_a + skin * clipped_a
        out_lab[:, :, 2] = source_lab[:, :, 2] + (1.0 - skin) * delta_b + skin * clipped_b

        # additional soft anchor to original skin chroma
        anchor = 0.55 * s * skin
        out_lab[:, :, 1] = out_lab[:, :, 1] * (1.0 - anchor) + source_lab[:, :, 1] * anchor
        out_lab[:, :, 2] = out_lab[:, :, 2] * (1.0 - anchor) + source_lab[:, :, 2] * anchor

    out_bgr = cv2.cvtColor(np.clip(out_lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    out_bgr = _apply_colorby_signature_calibration(
        source_bgr=source_bgr,
        output_bgr=out_bgr,
        color_strength=color_strength,
        tone_strength=tone_strength,
    )
    return out_bgr


def _apply_saturation_and_vibrance(image_bgr: np.ndarray, sat: float, vib: float) -> np.ndarray:
    if sat == 0 and vib == 0:
        return image_bgr
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[:, :, 1]
    if sat != 0:
        s *= 1.0 + sat / 100.0
    if vib != 0:
        normalized_s = s / 255.0
        vib_gain = (1.0 - normalized_s) * (vib / 100.0) * 1.25
        s *= 1.0 + vib_gain
    hsv[:, :, 1] = np.clip(s, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def _apply_hsl_colour_science(image_bgr: np.ndarray, hue: float, hsl_sat: float, hsl_light: float) -> np.ndarray:
    if hue == 0 and hsl_sat == 0 and hsl_light == 0:
        return image_bgr
    rgb = _to_rgb(image_bgr).astype(np.float32) / 255.0
    hsl = colour.RGB_to_HSL(rgb)

    hsl[:, :, 0] = (hsl[:, :, 0] + (hue / 360.0)) % 1.0
    hsl[:, :, 1] = np.clip(hsl[:, :, 1] * (1.0 + hsl_sat / 100.0), 0.0, 1.0)
    hsl[:, :, 2] = np.clip(hsl[:, :, 2] + (hsl_light / 100.0) * 0.35, 0.0, 1.0)

    rgb_out = np.clip(colour.HSL_to_RGB(hsl), 0.0, 1.0)
    return _to_bgr((rgb_out * 255.0).astype(np.uint8))


def _normalize_hsl7_payload(hsl7: Optional[Dict[str, Dict[str, float]]]) -> Optional[Dict[str, Dict[str, float]]]:
    if not isinstance(hsl7, dict):
        return None

    def to_float(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return float(default)

    out: Dict[str, Dict[str, float]] = {}
    non_zero = False
    for band in HSL7_BANDS:
        item = hsl7.get(band, {})
        if not isinstance(item, dict):
            item = {}
        h = to_float(item.get("h", item.get("hue", 0.0)))
        s = to_float(item.get("s", item.get("sat", item.get("saturation", 0.0))))
        l = to_float(item.get("l", item.get("lum", item.get("light", item.get("lightness", 0.0)))))
        h = float(np.clip(h, -100.0, 100.0))
        s = float(np.clip(s, -100.0, 100.0))
        l = float(np.clip(l, -100.0, 100.0))
        out[band] = {"h": h, "s": s, "l": l}
        if abs(h) > 1e-6 or abs(s) > 1e-6 or abs(l) > 1e-6:
            non_zero = True
    return out if non_zero else None


def _hue_band_weight(h_deg: np.ndarray, center_deg: float, width_deg: float) -> np.ndarray:
    # Circular angular distance in degrees.
    dist = np.abs(((h_deg - center_deg + 180.0) % 360.0) - 180.0)
    t = np.clip(1.0 - dist / width_deg, 0.0, 1.0)
    # Smoothstep for soft transitions between neighboring hue bands.
    return t * t * (3.0 - 2.0 * t)


def _apply_hsl_7way(image_bgr: np.ndarray, hsl7: Optional[Dict[str, Dict[str, float]]]) -> np.ndarray:
    payload = _normalize_hsl7_payload(hsl7)
    if payload is None:
        return image_bgr

    rgb = _to_rgb(image_bgr).astype(np.float32) / 255.0
    hsl = colour.RGB_to_HSL(rgb)
    h0 = hsl[:, :, 0] * 360.0
    s0 = hsl[:, :, 1]
    l0 = hsl[:, :, 2]

    hue_shift = np.zeros_like(h0, dtype=np.float32)
    sat_gain = np.zeros_like(s0, dtype=np.float32)
    light_add = np.zeros_like(l0, dtype=np.float32)

    for band in HSL7_BANDS:
        v = payload[band]
        w = _hue_band_weight(h0, HSL7_CENTERS[band], HSL7_BAND_WIDTH_DEG)
        # Per-band hue uses a conservative shift range to reduce artifacts.
        hue_shift += w * (v["h"] * 0.45)
        sat_gain += w * (v["s"] / 100.0)
        light_add += w * (v["l"] / 100.0) * 0.35

    h = (h0 + hue_shift) % 360.0
    s = np.clip(s0 * (1.0 + sat_gain), 0.0, 1.0)
    l = np.clip(l0 + light_add, 0.0, 1.0)

    out_hsl = np.stack([h / 360.0, s, l], axis=-1)
    rgb_out = np.clip(colour.HSL_to_RGB(out_hsl), 0.0, 1.0)
    return _to_bgr((rgb_out * 255.0).astype(np.uint8))


def _apply_temp_tint(image_bgr: np.ndarray, temp: float, tint: float) -> np.ndarray:
    if temp == 0 and tint == 0:
        return image_bgr
    img = image_bgr.astype(np.float32)
    temp_gain = temp * 0.75
    tint_gain = tint * 0.6

    # temp: warm -> more red, less blue; tint: magenta <-> green
    img[:, :, 2] += temp_gain + 0.5 * tint_gain
    img[:, :, 0] -= temp_gain - 0.5 * tint_gain
    img[:, :, 1] -= tint_gain
    return np.clip(img, 0, 255).astype(np.uint8)


def _apply_contrast(image_bgr: np.ndarray, contrast: float) -> np.ndarray:
    if contrast == 0:
        return image_bgr
    alpha = 1.0 + contrast / 100.0
    out = (image_bgr.astype(np.float32) - 127.5) * alpha + 127.5
    return np.clip(out, 0, 255).astype(np.uint8)


def _apply_curve_skimage(image_bgr: np.ndarray, curve: float) -> np.ndarray:
    if curve == 0:
        return image_bgr
    rgb = _to_rgb(image_bgr).astype(np.float32) / 255.0
    if curve > 0:
        gain = 6.0 + 8.0 * (curve / 100.0)
        curved = adjust_sigmoid(rgb, cutoff=0.5, gain=gain, inv=False)
    else:
        gain = 2.0 + 5.0 * (abs(curve) / 100.0)
        curved = adjust_sigmoid(rgb, cutoff=0.5, gain=gain, inv=True)
    return _to_bgr(np.clip(curved * 255.0, 0, 255).astype(np.uint8))


def _sanitize_curve_points(points: Optional[List[Tuple[float, float]]]) -> Optional[List[Tuple[float, float]]]:
    if not points or len(points) < 2:
        return None
    clean = []
    for x, y in points:
        clean.append((float(np.clip(x, 0.0, 1.0)), float(np.clip(y, 0.0, 1.0))))
    clean.sort(key=lambda p: p[0])
    if clean[0][0] > 0.0:
        clean.insert(0, (0.0, clean[0][1]))
    if clean[-1][0] < 1.0:
        clean.append((1.0, clean[-1][1]))
    clean[0] = (0.0, clean[0][1])
    clean[-1] = (1.0, clean[-1][1])
    return clean


def _build_curve_lut(points: Optional[List[Tuple[float, float]]]) -> Optional[np.ndarray]:
    points = _sanitize_curve_points(points)
    if points is None:
        return None
    xs = np.array([p[0] for p in points], dtype=np.float32)
    ys = np.array([p[1] for p in points], dtype=np.float32)
    return np.interp(np.linspace(0.0, 1.0, 256), xs, ys).astype(np.float32)


def _apply_curve_points(image_bgr: np.ndarray, points: Optional[List[Tuple[float, float]]]) -> np.ndarray:
    lut = _build_curve_lut(points)
    if lut is None:
        return image_bgr
    rgb = _to_rgb(image_bgr)
    out_rgb = lut[rgb] * 255.0
    return _to_bgr(np.clip(out_rgb, 0.0, 255.0).astype(np.uint8))


def _apply_rgb_curves(
    image_bgr: np.ndarray,
    points_r: Optional[List[Tuple[float, float]]],
    points_g: Optional[List[Tuple[float, float]]],
    points_b: Optional[List[Tuple[float, float]]],
) -> np.ndarray:
    lut_r = _build_curve_lut(points_r)
    lut_g = _build_curve_lut(points_g)
    lut_b = _build_curve_lut(points_b)
    if lut_r is None and lut_g is None and lut_b is None:
        return image_bgr

    rgb = _to_rgb(image_bgr)
    out = rgb.copy()
    if lut_r is not None:
        out[:, :, 0] = np.clip(lut_r[rgb[:, :, 0]] * 255.0, 0.0, 255.0).astype(np.uint8)
    if lut_g is not None:
        out[:, :, 1] = np.clip(lut_g[rgb[:, :, 1]] * 255.0, 0.0, 255.0).astype(np.uint8)
    if lut_b is not None:
        out[:, :, 2] = np.clip(lut_b[rgb[:, :, 2]] * 255.0, 0.0, 255.0).astype(np.uint8)
    return _to_bgr(out)


def _apply_highlight_shadow(image_bgr: np.ndarray, highlights: float, shadows: float) -> np.ndarray:
    if highlights == 0 and shadows == 0:
        return image_bgr
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l = lab[:, :, 0] / 255.0
    if highlights != 0:
        high_mask = np.clip((l - 0.5) / 0.5, 0.0, 1.0)
        l += high_mask * (highlights / 100.0) * 0.25
    if shadows != 0:
        shadow_mask = np.clip((0.5 - l) / 0.5, 0.0, 1.0)
        l += shadow_mask * (shadows / 100.0) * 0.25
    lab[:, :, 0] = np.clip(l * 255.0, 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def _apply_sharpen(image_bgr: np.ndarray, sharpen: float) -> np.ndarray:
    if sharpen <= 0:
        return image_bgr
    amount = np.clip(sharpen / 40.0, 0.0, 1.0) * 1.5
    blur = cv2.GaussianBlur(image_bgr, (0, 0), 1.2)
    out = cv2.addWeighted(image_bgr, 1.0 + amount, blur, -amount, 0)
    return np.clip(out, 0, 255).astype(np.uint8)


def _apply_grain(image_bgr: np.ndarray, grain: float) -> np.ndarray:
    if grain <= 0:
        return image_bgr
    sigma = np.clip(grain / 40.0, 0.0, 1.0) * 12.0
    noise = np.random.normal(0.0, sigma, (image_bgr.shape[0], image_bgr.shape[1], 1)).astype(np.float32)
    out = image_bgr.astype(np.float32) + noise
    return np.clip(out, 0, 255).astype(np.uint8)


def apply_micro_edits(image_bgr: np.ndarray, edits: EditParams) -> np.ndarray:
    out = image_bgr
    out = _apply_saturation_and_vibrance(out, edits.sat, edits.vib)
    out = _apply_hsl_colour_science(out, edits.hue, edits.hsl_sat, edits.hsl_light)
    out = _apply_hsl_7way(out, edits.hsl7)
    out = _apply_temp_tint(out, edits.temp, edits.tint)
    out = _apply_contrast(out, edits.contrast)
    out = _apply_curve_points(out, edits.curve_points)
    out = _apply_rgb_curves(out, edits.curve_points_r, edits.curve_points_g, edits.curve_points_b)
    out = _apply_curve_skimage(out, edits.curve)
    out = _apply_highlight_shadow(out, edits.highlights, edits.shadows)
    out = _apply_sharpen(out, edits.sharpen)
    out = _apply_grain(out, edits.grain)
    return out
