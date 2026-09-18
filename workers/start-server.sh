#!/bin/sh
set -eu

# The runtime probe loads Chromium and BiRefNet before Nitro can listen on port 3000.
# Keep it opt-in so a production restart remains available to Coolify immediately.
if [ "${VERIFY_RUNTIME_ON_STARTUP:-0}" = "1" ]; then
  "$PRODUCT_IMAGE_PYTHON" workers/verify_runtime.py
else
  echo "Runtime verification skipped at startup; the image self-test ran during build." >&2
fi

exec node .output/server/index.mjs
