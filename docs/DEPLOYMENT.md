# VPS deployment (systemd / Docker)

This document describes how to run the Firefly (formerly Odyssee) listener on a Linux VPS. The repository contains a Dockerfile, a simple deploy script and a systemd unit file to run the compiled listener.

## Create system user and app dir

```bash
sudo adduser --disabled-password --gecos "" odyssee
sudo mkdir -p /opt/odyssee
sudo chown odyssee:odyssee /opt/odyssee
```

## Install Node 18, git

Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential
```

## Clone & configure

```bash
sudo -u odyssee git clone https://github.com/glitzereinhorn270487/firefly.git /opt/odyssee
sudo mkdir -p /etc/odyssee
sudo tee /etc/odyssee/.env > /dev/null 
RPC_WSS=wss://your-quicknode-wss
WEBHOOK_URL=https://your-vercel-app/api/webhooks/quicknode
WEBHOOK_AUTH=super-secret-token
PORT=3000
MAX_GETTX_PER_SEC=5
EOF
sudo chmod 600 /etc/odyssee/.env
```

## Build & run

```bash
cd /opt/odyssee
npm ci
npm run build:listener
sudo cp ops/odyssee-listener.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now odyssee-listener
```

## Deploy script

Use the provided deploy script for future deploys:

```bash
sudo ./scripts/deploy.sh main
```