# Kinolu Demo (Local)

## MVP Status (Current)

This repo is now a usable local MVP:

- Reference -> target color transfer (multi-method + `auto_best`)
- Auto XY recommendation + manual XY override
- Basic edit surface (curve + HSL + film boost)
- Export bundle (`.cube` / `.xmp` / optional test `.dng`)

Gap to production quality is mainly model/quality iteration, not base pipeline availability.

## Workspace Layout (After Cleanup)

- Runtime core:
  - `backend/`
  - `frontend/`
  - `third_party/`
  - `models/`
- Product docs:
  - `README.md`
  - `prd draft.md`
- Experiment inputs:
  - `archive/local_assets_20260213/CB/` (local benchmark assets)
  - `archive/local_assets_20260213/datasets/` (local benchmark assets)
- Experiment scripts:
  - `tools/`
- Outputs:
  - Active results in `out/`
  - Historical runs in `out/_archive_20260213/`
- Legacy backup:
  - `archive/backup_legacy_20260213/`
  - `archive/vendor_legacy_20260213/`

> `archive/` is local-only and ignored by Git by default.
> If you want to run dataset scripts, pass the archived dataset paths explicitly.

## Run

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 -m pip install --user -r requirements.txt
python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

Open:

- `http://127.0.0.1:8000`
- Next.js app (separate terminal):
  - `cd kinolu-next && npm run dev`
  - open `http://localhost:3000`

## Notes

- Do not open `frontend/index.html` directly via `file://`.
- The page sends image form data to `POST /api/transfer`.
- Built-in methods:
  - Default runtime is **stable-only**: `reinhard_lab` (jrosebr1 base + Kinolu pipeline tweaks).
  - To re-enable multi-method experiments, set `KINOLU_STABLE_ONLY=0` before starting backend.
- Frontend MVP mode:
  - UI is simplified to a fixed pipeline: `reinhard_lab` + built-in cinematic enhancement.
  - Users focus on XY placement and basic edits; method switching is hidden from UI.
- XY workflow:
  - `Auto XY` (default on): backend analyzes source/reference + portrait risk and recommends Color/Tone strengths.
  - Manual defaults (when `Auto XY` is off): `Color=88`, `Tone=78` (tuned on current Colorby benchmark set).
  - Turn `Auto XY` off to use manual XY values.
- Open-source enhancement stack:
  - Skin/subject regions: `google-ai-edge/mediapipe` + optional `MobileSAM`
  - Core image ops: `opencv/opencv`
  - HSL edits: `colour-science/colour`
  - Tone curve edits: `scikit-image` + draggable curve editor (frontend)
- Editing surface:
  - Curves: `Master + R + G + B`, add/drag/remove control points
  - HSL: global H/S/L plus 7-way hue bands (`red/orange/yellow/green/aqua/blue/purple`)
  - Film tone: `Cinematic Film Boost` (toe/shadow lift + highlight shoulder + micro-contrast)
  - Colorby-signature calibration: post-XY tone/saturation alignment learned from local benchmark pairs
- License snapshot (check before production release):
  - `colortrans`: MIT
  - `third_party/color_transfer`: MIT
  - `OpenCV`: Apache-2.0
  - `MediaPipe`: Apache-2.0
  - `colour-science`: BSD-3-Clause
  - `PiDNG (pidng)`: MIT (dist LICENSE file)

## Preset + LUT API (Current)

- `GET /api/presets`: list saved presets
- `POST /api/presets/import-cube`: import third-party `.cube` and save as preset
- `POST /api/presets/from-transfer`: save current look (source + styled image) as generated preset
- `POST /api/presets/apply`: apply a saved preset LUT to an image
- `PATCH /api/presets/{id}` / `DELETE /api/presets/{id}`
- `GET /api/presets/{id}/cube`: download preset `.cube`
- `POST /api/export/lut`: export current source+styled pair as `.cube` (without saving preset)

## MobileSAM (Optional but recommended)

Install dependencies (already included in `requirements.txt`) and download checkpoint:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
./tools/download_mobile_sam.sh
export MOBILE_SAM_CHECKPOINT=/Users/johnson/Desktop/开发/Web/Kinolu/models/mobile_sam.pt
```

Then restart uvicorn. You can verify runtime capability:

```bash
curl -sS http://127.0.0.1:8000/api/capabilities
```

## Quick Method Compare

Generate side-by-side outputs for all built-in methods:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/compare_methods.py \
  --reference /path/to/reference.jpg \
  --source /path/to/source.jpg \
  --out-dir out/method_compare
```

## Systematic Quality Evaluation

Prepare a CSV manifest (for example under `archive/local_assets_20260213/datasets/`), then run:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/evaluate_dataset.py \
  --manifest /path/to/manifest.csv \
  --methods hybrid_auto,reinhard_lab,reinhard,lhm \
  --out-dir out/eval_dataset \
  --save-images
```

Outputs:

- `out/eval_dataset/results.json`
- `out/eval_dataset/summary.json`
- `out/eval_dataset/summary.md`

## Build Open Photography Seed Set (CC0 / StockSnap via Openverse)

Fetch a permissive-license seed set from Openverse and auto-build a local manifest:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/fetch_openverse_seed.py \
  --out-root archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2 \
  --reference-count 12 \
  --target-count 24 \
  --pair-count 24 \
  --licenses cc0 \
  --sources stocksnap \
  --reference-queries-file archive/local_assets_20260213/datasets/queries/reference_photography.txt \
  --target-queries-file archive/local_assets_20260213/datasets/queries/target_neutral.txt \
  --min-width 900 \
  --min-height 600 \
  --pages-per-query 3 \
  --request-sleep 0.25
```

Outputs:

- `archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/references.csv`
- `archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/targets.csv`
- `archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/manifest.csv`

Then evaluate directly:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/evaluate_dataset.py \
  --manifest archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/manifest.csv \
  --methods auto_best,hybrid_auto,reinhard_lab,reinhard,lhm \
  --out-dir out/eval_stocksnap_v2 \
  --save-images
```

For full pair cross product (`reference_count x target_count`), build cartesian manifest:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/build_cartesian_manifest.py \
  --references-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/references.csv \
  --targets-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/targets.csv \
  --out-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/manifest.cartesian.csv
```

Example: run all `12 x 24 = 288` pairs with `reinhard_lab`:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/evaluate_dataset.py \
  --manifest archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/manifest.cartesian.csv \
  --methods reinhard_lab \
  --out-dir out/eval_stocksnap_v2_cartesian_reinhard \
  --save-images
```

Saved filenames include both pair id and source mapping:

- `ref001-to-tgt001__ref-...__src-...__reinhard_lab.jpg`

## Compare With Colorby (Same Pair Set)

1) Fill `colorby_output` column in:

- `archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/colorby_compare_template.csv`
- `archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/colorby_compare_template.cartesian.csv` (for full 288-pair run)

2) Run:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/compare_with_colorby.py \
  --pairs-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/colorby_compare_template.csv \
  --our-column our_reinhard_lab \
  --out-dir out/compare_colorby_stocksnap_v2
```

## Analyze Exported Colorby Folder (e.g. 6x9 batches)

If you exported grouped Colorby results in `archive/local_assets_20260213/CB/refXX_target...`, run:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/analyze_colorby_cb_folder.py \
  --cb-root archive/local_assets_20260213/CB \
  --references-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/references.csv \
  --targets-csv archive/local_assets_20260213/datasets/openverse_stocksnap_photo_v2/targets.csv \
  --ref-count 6 \
  --target-count 9 \
  --out-dir out/analyze_colorby_cb_v1
```

Main outputs:

- `out/analyze_colorby_cb_v1/matched_pairs.csv` (auto-mapped pair alignment)
- `out/analyze_colorby_cb_v1/report.md` (method ranking + tuned strengths)
- `out/analyze_colorby_cb_v1/reinhard_tuning_grid.json`

Quick score snapshot from this benchmark is stored in:

- `out/analyze_colorby_cb_v2_quick_summary.json`

## Export Consistency Bundle

Preview + fitted `.cube` + `.xmp` + optional `.dng` + LUT parity report:

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/export_bundle.py \
  --reference /path/to/reference.jpg \
  --source /path/to/source.jpg \
  --method hybrid_auto \
  --out-dir out/export_bundle \
  --emit-dng 1
```

Outputs:

- `preview.jpg`
- `look_33.cube`
- `look.xmp`
- `look.dng` (synthetic Bayer DNG for workflow testing)
- `preview_from_lut.jpg`
- `export_report.json`

## Batch / Stability Stress Test

```bash
cd /Users/johnson/Desktop/开发/Web/Kinolu
python3 tools/stress_test.py \
  --manifest /path/to/manifest.csv \
  --methods hybrid_auto,reinhard_lab \
  --resolutions 512,768,1024,1536,2048 \
  --iterations 2 \
  --out-dir out/stress_test
```

Outputs:

- `out/stress_test/stress_results.json`
- `out/stress_test/stress_summary.json`
- `out/stress_test/stress_summary.md`

## 1-Week Sprint (Practical)

1. Day 1-2: lock `hybrid_auto` + skin protection parameters on 20-50 real photos.
2. Day 3-4: tune curve/HSL defaults and export consistency.
3. Day 5: add 2-3 cinematic preset profiles with fixed parameter bundles.
4. Day 6-7: batch tests + performance pass + deploy small private beta.
