#!/bin/sh
set -eu
"$PRODUCT_IMAGE_PYTHON" workers/verify_runtime.py
exec node .output/server/index.mjs
