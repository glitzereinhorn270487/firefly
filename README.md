# firefly🤖 Update durch Firefly-Bot am 2025-08-31 13:12:26 UTC
🤖 Update durch Firefly-Bot am 2025-08-31 13:21:08 UTC
🤖 Update durch Firefly-Bot am 2025-08-31 13:22:38 UTC
🤖 Update durch Firefly-Bot am 2025-08-31 13:23:36 UTC
🤖 Update durch Firefly-Bot am 2025-08-31 13:32:05 UTC
🤖 Update durch Firefly-Bot am 2025-08-31 15:58:48 UTC

## QuickNode Webhook

Receiver: `/api/webhooks/quicknode?token=...`  
Erwarteter Header: `x-qn-token: ...`  
Beide müssen dem Secret `QN_WEBHOOK_TOKEN` entsprechen.

**Secrets setzen**  
- Lokal: `.env.local` → `QN_WEBHOOK_TOKEN=dein_token`
- Vercel Project Env / GitHub Secrets analog.

## Dashboard

- Seite: `/dashboard`
- Health-Endpoint: `/api/health`
- Komponenten: `AgentStatusBadge`, `AgentControls` (Demo)

