#!/usr/bin/env bash
#
# Install DCC-EX Railway Manager as a native systemd service (no Docker).
#
# Builds the Angular frontend + Node backend, serves the frontend as static
# files from the backend, and installs a systemd service that runs it on
# boot as the current user. Running natively (instead of in Docker) removes
# the docker/containerd boot cost and background daemon — useful on a
# battery-powered Raspberry Pi kiosk.
#
# Prereqs: Node.js >= 20 and npm on PATH. Run from the repo root:
#   ./deploy/install-native.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
cd "$REPO"

echo "==> Building frontend"
( cd frontend && npm install && npm run build )

echo "==> Building backend"
( cd backend && npm install && npm run build )

echo "==> Publishing frontend into backend/dist/public"
rm -rf backend/dist/public
cp -r frontend/dist/dccex-frontend/browser backend/dist/public

echo "==> Ensuring data directory"
mkdir -p backend/dist/data

echo "==> Installing systemd service (sudo)"
# Render the unit with this repo path + user, then install it.
sed -e "s#/home/main/dccex-railway-manager#${REPO}#g" \
    -e "s#^User=main#User=${SERVICE_USER}#" \
    deploy/dccex.service | sudo tee /etc/systemd/system/dccex.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now dccex.service

sleep 3
echo "==> Health check"
curl -fsS http://localhost:3000/api/health && echo
echo "Done. Manage with: sudo systemctl {status,restart,stop} dccex.service"
