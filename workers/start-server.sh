#!/bin/sh
set -eu

# The runtime probe loads Chromium and BiRefNet before Nitro can listen on port 3000.
# Keep it opt-in so a production restart remains available to Coolify immediately.
if [ "${VERIFY_RUNTIME_ON_STARTUP:-0}" = "1" ]; then
  "$PRODUCT_IMAGE_PYTHON" workers/verify_runtime.py
else
  echo "Runtime verification skipped at startup; the image self-test ran during build." >&2
fi

# A agenda tem fila própria no PostgreSQL. Mantê-la ativa no mesmo container
# evita jobs pendentes quando só a aplicação web foi provisionada no Coolify.
# SKIP LOCKED + lease permitem mais de uma réplica sem processar o mesmo job.
if [ "${RADIO_WORKER_ENABLED:-1}" = "1" ]; then
  (
    while :; do
      if ./workers/start-radio-worker.sh; then
        echo "Radio worker exited; restarting in 5 seconds." >&2
      else
        echo "Radio worker failed; restarting in 5 seconds." >&2
      fi
      sleep 5
    done
  ) &
fi

exec node .output/server/index.mjs
