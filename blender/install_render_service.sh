#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
root=$(pwd)
account=$(id -un)
chmod +x status.sh run_final.sh
sudo tee /etc/systemd/system/embertarn-render.service >/dev/null <<EOF
[Unit]
Description=Embertarn approved Cycles film - resumable spot render
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0
ConditionPathExists=!$root/DONE

[Service]
Type=simple
User=$account
WorkingDirectory=$root
Environment=APPROVED_STILLS=1
Environment=PYTHONUNBUFFERED=1
ExecStartPre=/bin/bash -c 'until /usr/bin/nvidia-smi >/dev/null 2>&1; do sleep 10; done'
ExecStart=/bin/bash $root/run_final.sh
Restart=on-failure
RestartSec=60
TimeoutStartSec=600
TimeoutStopSec=60
KillMode=control-group
StandardOutput=append:$root/service.log
StandardError=append:$root/service.log

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable embertarn-render.service
# Explicit --start is used only after the review checks pass.
if [ "${1:-}" = --start ]; then sudo systemctl start embertarn-render.service; fi
