# Deployment (Vercel) — Kurzinfo

Benötigte Umgebungsvariablen (füge sie in Vercel > Project > Settings > Environment Variables ein):
- QUICKNODE_RPC_URL
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- PAPER_TRADING (true/false)
- PAPER_INVEST_USD
- GLOBAL_MAX_INVESTMENT_USD
- PAPER_TRADER_START_USD
- LOG_LEVEL

Start-Command
- Vercel erkennt das Projekt normalerweise automatisch. Für Next/Node:
  - Build: npm run build
  - Start: npm start (oder entsprechend package.json scripts)

Cronjobs / Vercel Scheduled Functions
- Für manage-positions heartbeat: Richte in Vercel einen cron job ein, der die Route `/api/manage-positions` alle 15s/60s aufruft (Vercel Scheduler Addon bzw. externe CronTrigger falls 15s nicht möglich).

Paper-Trading Debug
- Setze `PAPER_TRADING=true` in Production/Staging, um Simulationen zu laufen und Logs/Redis-Positionsdaten zu prüfen.