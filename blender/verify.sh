#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 bench.py
python3 resume_test.py
echo "$(date -Is) verification complete"
