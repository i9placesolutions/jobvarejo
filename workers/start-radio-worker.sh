#!/bin/sh
set -eu

# O Docker do JobVarejo já instala psycopg no mesmo ambiente usado pelos
# workers Python. No desenvolvimento, use o python3 local normalmente.
PYTHON_BIN="${RADIO_WORKER_PYTHON:-${PRODUCT_IMAGE_PYTHON:-python3}}"
exec "$PYTHON_BIN" workers/radio_worker.py "$@"
