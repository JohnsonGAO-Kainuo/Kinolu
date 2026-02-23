# Workspace Layout

This file explains how the repository is organized for a clean MVP workflow.

## 1) Runtime (must keep clean)

- `backend/`: FastAPI API and core processing pipeline
- `frontend/`: legacy demo UI (served by backend, still useful for feature reference)
- `kinolu-next/`: current Next.js app UI (mobile-first PWA direction)
- `third_party/`: vendored OSS libs used at runtime
- `models/`: model checkpoints (for optional features like MobileSAM)
- `requirements.txt`: Python dependencies

## 2) Product docs

- `README.md`: runbook + evaluation/export commands
- `prd draft.md`: product requirements draft

## 3) Experiment assets

- `archive/local_assets_20260213/CB/`: exported Colorby batches for comparison
- `archive/local_assets_20260213/datasets/`: benchmark/evaluation datasets and manifests
- `tools/`: evaluation/tuning/export scripts

## 4) Outputs

- `out/`: active output directory (latest reports/images)
- `out/_archive_20260213/`: archived historical runs

## 5) Legacy data

- `archive/backup_legacy_20260213/`: old backup folder, kept for safety
- `archive/vendor_legacy_20260213/`: optional vendored libs moved out from runtime path
- `archive/ui_prototypes_20260223/`: archived prototype HTML attempts

## Practical rule

For day-to-day development, focus on:

1. `backend/`
2. `kinolu-next/`
3. `tools/` (only scripts needed for current task)
4. a small subset of `out/` (current run only)

## Git Push rule

- `archive/` is ignored by `.gitignore`.
- Local assets and backups under `archive/` are not pushed by default.
