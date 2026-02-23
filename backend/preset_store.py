from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Optional
import uuid

import numpy as np

from backend.lut_utils import apply_lut_to_bgr, fit_lut_from_pair, load_lut, write_cube

ROOT = Path(__file__).resolve().parents[1]
PRESET_DIR = Path(os.getenv("KINOLU_PRESET_DIR", str(ROOT / "out" / "presets")))
INDEX_PATH = PRESET_DIR / "index.json"
CUBE_DIR = PRESET_DIR / "cube"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_store() -> None:
    PRESET_DIR.mkdir(parents=True, exist_ok=True)
    CUBE_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_PATH.exists():
        INDEX_PATH.write_text(json.dumps({"version": 1, "items": []}, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_index() -> dict:
    _ensure_store()
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"version": 1, "items": []}


def _write_index(data: dict) -> None:
    _ensure_store()
    INDEX_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def list_presets() -> list[dict]:
    data = _read_index()
    items = data.get("items", [])
    items = sorted(items, key=lambda x: x.get("updated_at", ""), reverse=True)
    return items


def get_preset(preset_id: str) -> Optional[dict]:
    for item in list_presets():
        if item.get("id") == preset_id:
            return item
    return None


def _safe_name(name: str) -> str:
    raw = (name or "").strip()
    return raw if raw else "Untitled Preset"


def _cube_path_from_entry(entry: dict) -> Path:
    rel = entry.get("cube_file", "")
    return (PRESET_DIR / rel).resolve()


def _append_entry(entry: dict) -> dict:
    data = _read_index()
    items = data.get("items", [])
    items.append(entry)
    data["items"] = items
    _write_index(data)
    return entry


def create_preset_from_cube_bytes(name: str, cube_bytes: bytes, source_type: str = "imported_cube") -> dict:
    _ensure_store()
    preset_id = f"preset_{uuid.uuid4().hex[:12]}"
    cube_name = f"{preset_id}.cube"
    cube_path = CUBE_DIR / cube_name
    cube_path.write_bytes(cube_bytes)
    now = _now_iso()
    entry = {
        "id": preset_id,
        "name": _safe_name(name),
        "source_type": source_type,
        "cube_file": f"cube/{cube_name}",
        "created_at": now,
        "updated_at": now,
    }
    return _append_entry(entry)


def create_preset_from_images(
    name: str,
    source_bgr: np.ndarray,
    styled_bgr: np.ndarray,
    cube_size: int = 33,
    sample_pixels: int = 80000,
) -> dict:
    lut = fit_lut_from_pair(source_bgr, styled_bgr, cube_size=cube_size, sample_pixels=sample_pixels)
    preset_id = f"preset_{uuid.uuid4().hex[:12]}"
    cube_name = f"{preset_id}.cube"
    cube_path = CUBE_DIR / cube_name
    write_cube(lut, cube_path)
    now = _now_iso()
    entry = {
        "id": preset_id,
        "name": _safe_name(name),
        "source_type": "generated",
        "cube_file": f"cube/{cube_name}",
        "created_at": now,
        "updated_at": now,
    }
    return _append_entry(entry)


def rename_preset(preset_id: str, name: str) -> Optional[dict]:
    data = _read_index()
    items = data.get("items", [])
    for item in items:
        if item.get("id") == preset_id:
            item["name"] = _safe_name(name)
            item["updated_at"] = _now_iso()
            _write_index(data)
            return item
    return None


def delete_preset(preset_id: str) -> bool:
    data = _read_index()
    items = data.get("items", [])
    kept = []
    removed = None
    for item in items:
        if item.get("id") == preset_id:
            removed = item
            continue
        kept.append(item)
    if removed is None:
        return False
    data["items"] = kept
    _write_index(data)
    cube_path = _cube_path_from_entry(removed)
    try:
        if cube_path.exists():
            cube_path.unlink()
    except Exception:
        pass
    return True


def get_preset_cube_path(preset_id: str) -> Optional[Path]:
    entry = get_preset(preset_id)
    if not entry:
        return None
    path = _cube_path_from_entry(entry)
    if not path.exists():
        return None
    return path


def apply_preset_to_image(source_bgr: np.ndarray, preset_id: str) -> np.ndarray:
    cube_path = get_preset_cube_path(preset_id)
    if cube_path is None:
        raise ValueError(f"Preset not found: {preset_id}")
    lut = load_lut(cube_path)
    if lut is None:
        raise ValueError("Invalid preset cube file")
    return apply_lut_to_bgr(source_bgr, lut)
