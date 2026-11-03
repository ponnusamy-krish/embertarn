#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $(id -u) == 0 ]]; then SUDO=(); else SUDO=(sudo); fi
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y ca-certificates curl gnupg ffmpeg vulkan-tools libvulkan1 fonts-dejavu-core xz-utils bzip2
"${SUDO[@]}" install -d -m 0755 /etc/apt/keyrings
keytmp=$(mktemp -d)
trap 'rm -rf "$keytmp"' EXIT
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor > "$keytmp/node.gpg"
curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > "$keytmp/google.gpg"
"${SUDO[@]}" install -m 0644 "$keytmp/node.gpg" /etc/apt/keyrings/nodesource.gpg
"${SUDO[@]}" install -m 0644 "$keytmp/google.gpg" /etc/apt/keyrings/google-chrome.gpg
echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' | "${SUDO[@]}" tee /etc/apt/sources.list.d/nodesource.list >/dev/null
echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main' | "${SUDO[@]}" tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y nodejs google-chrome-stable
export CHROME_BIN=/usr/bin/google-chrome
export PUPPETEER_SKIP_DOWNLOAD=true
npm ci
npm run build
node --version
"$CHROME_BIN" --version
nvidia-smi
vulkaninfo --summary
if [[ $(id -u) == 0 && ${CHROME_NO_SANDBOX:-0} != 1 ]]; then
 echo 'Run the probe/job as an unprivileged user (recommended), or explicitly set CHROME_NO_SANDBOX=1 for an isolated root container.' >&2
 exit 1
fi
node scripts/probe.mjs
