```markdown
# Deploy-Anleitung (Hetzner / günstiger VPS)

Kurz: Diese Anleitung zeigt Schritt für Schritt, wie ihr den Listener + Webhook Receiver auf einem günstigen Hetzner VPS deployt.

Voraussetzungen:
- Hetzner Account
- SSH Key
- Node.js 18+ installiert auf der VPS
- Neue (rotierte) QuickNode RPC WSS-URL und WEBHOOK_URL/SECRET

1) VPS anlegen (Hetzner)
- Empfehlung: CX11 (1 vCPU, 2 GB RAM) — sehr günstig (~3-6 USD/Monat)
- OS: Ubuntu 22.04 LTS
- Setze deinen SSH-Key beim Erstellen.

2) Basis Einrichtung (SSH)
```bash
ssh root@<VPS_IP>
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs build-essential git
# optional: yarn or npm (npm comes with node)
```

3) Repo klonen & env Datei anlegen
```bash
git clone git@github.com:glitzereinhorn270487/odyssee.git
cd odyssee
# optional: wechsle branch fix-runtime-issues (nachdem PR gemerged)
git checkout fix-runtime-issues
cp .env.example .env
# edit .env:
# RPC_WSS=wss://...
# WEBHOOK_URL=https://your-webhook.example.com/webhook
# WEBHOOK_AUTH=your-outgoing-bearer (used by listener)
# WEBHOOK_SECRET=your-incoming-bearer (used by webhook receiver)
# MODE=paper
```

4) Abhängigkeiten & Build
```bash
npm install
npm run build
# oder in dev: npm run dev:listener / npm run dev:webhook
```

5) Systemd Unit (Production) — Listener & Webhook
Erstelle zwei Services:
- /etc/systemd/system/odyssee-listener.service
- /etc/systemd/system/odyssee-webhook.service

Beispiel:
```ini
[Unit]
Description=Odyssee Listener
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/root/odyssee/.env
WorkingDirectory=/root/odyssee
ExecStart=/usr/bin/node dist/listener.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Analog für webhook: ExecStart node dist/webhook_handler.js

Starten:
```bash
systemctl daemon-reload
systemctl enable --now odyssee-listener
systemctl enable --now odyssee-webhook
journalctl -fu odyssee-listener
```

6) Monitoring & Safety
- Setze Firewall (ufw) nur für Ports 22 und 80/443 (falls Webhook öffentlich).
- Nutze Fail2Ban.
- Aktiviere QuickNode Usage Alerts im Dashboard.
- Setze in Listener MAX_GETTX_PER_SEC = 5 (env), bei Bedarf reduzieren.

7) Test
- Set MODE=paper und teste, ob Listener Webhook POSTs sendet und webhook_receiver logs schreibt.
- Beobachte Bandbreite und getParsedTransaction-Zähler die ersten Stunden.
```
