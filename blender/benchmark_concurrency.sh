#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 throughput.py --concurrent 1 --config benchmark-config.json
python3 throughput.py --concurrent 2 --config benchmark-config.json
python3 throughput.py --concurrent 3 --config benchmark-config.json
python3 summarize_throughput.py
