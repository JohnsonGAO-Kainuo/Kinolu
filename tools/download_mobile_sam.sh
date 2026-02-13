#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="${ROOT_DIR}/models"
MODEL_PATH="${MODEL_DIR}/mobile_sam.pt"
URL="${1:-https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt}"

mkdir -p "${MODEL_DIR}"
echo "Downloading MobileSAM checkpoint to ${MODEL_PATH}"
curl -L "${URL}" -o "${MODEL_PATH}"
echo "Done. Set env:"
echo "  export MOBILE_SAM_CHECKPOINT=${MODEL_PATH}"
