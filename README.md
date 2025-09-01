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


## Rules

- API: `/api/rules` (Liste der registrierten Regeln)
- Admin-Seite: `/settings/rules`
- Code: `src/rules` (types, registry, examples)
- Beispielregel: `demo/ok`


## Webhooks

- **QuickNode Receiver**: `POST /api/webhooks/quicknode`
  - prüft Header `x-qn-token` gegen `process.env.QN_WEBHOOK_TOKEN`
  - Payload wird geloggt
- **Test-Route**: `GET /api/webhooks/test` → liefert Zeit + ob Token gesetzt ist

## QuickNode Webhook
- Receiver: `POST /api/webhooks/quicknode?token=...`
- Env: set `QN_WEBHOOK_TOKEN` in Vercel or .env.local
- Test: `GET /api/webhooks/test`

## Trading Engine + Paper Trader
- `src/engine/tradingEngine.ts`: applies rules to events
- `src/engine/paperTrader.ts`: simulates trades
- Endpoint: `POST /api/trade` with `{ token, price, ...event }`

## Trading Engine + Paper Trader
- `src/engine/tradingEngine.ts`: applies rules to events
- `src/engine/paperTrader.ts`: simulates trades
- Endpoint: `POST /api/trade` with `{ token, price, ...event }`
