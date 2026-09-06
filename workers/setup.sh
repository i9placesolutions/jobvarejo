#!/bin/sh
set -eu
worker_env="${PRODUCT_IMAGE_VENV:-$HOME/.local/share/jobvarejo/image-worker}"
python3 -m venv "$worker_env"
"$worker_env/bin/pip" install -r "$(dirname "$0")/requirements.txt"
"$worker_env/bin/python" -m playwright install chromium
printf 'Configure PRODUCT_IMAGE_PYTHON=%s/bin/python\n' "$worker_env"
