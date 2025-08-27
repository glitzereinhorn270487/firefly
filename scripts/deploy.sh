#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/opt/odyssee"
SERVICE_NAME="odyssee-listener"

echo "Deploying firefly (branch: $BRANCH) into $APP_DIR"

mkdir -p "$APP_DIR"
chown "${SUDO_USER:-$(whoami)}":"${SUDO_USER:-$(whoami)}" "$APP_DIR" || true
cd "$APP_DIR"

if [ -d .git ]; then
  git fetch --all --prune
  git reset --hard "origin/$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  git clone https://github.com/glitzereinhorn270487/firefly.git .
  git checkout "$BRANCH"
fi

npm ci
npm run build:listener

if [ ! -f /etc/odyssee/.env ]; then
  echo "ERROR: /etc/odyssee/.env not found. Please create it with RPC_WSS, WEBHOOK_URL, WEBHOOK_AUTH and other vars."
  exit 1
fi

sudo systemctl daemon-reload || true
sudo systemctl enable --now "$SERVICE_NAME" || sudo systemctl restart "$SERVICE_NAME" || true

echo "Deploy finished."