#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MITM_TO_JSON="$SCRIPT_DIR/../mitm/mitm-to-json.py"

# By default, Authorization headers are redacted for safety
# To log Authorization headers, set: export MITM_LOG_AUTHORIZATION=1

# to stop the script, you need to press Ctrl+C twice in a row
# the first Ctrl-C will show a prompt `Terminate batch job (Y/N)?`, if the result is captured, you won't see it.
uvx --from mitmproxy mitmdump -q -s "$MITM_TO_JSON" "$@"
