# Raydium listener (quickstart)

This optional document explains how to quickly run the Raydium webhook stub and adapter locally for review and testing.

Quickstart scripts (optional)

- scripts/quickstart-listeners.js: starts the webhook stub on port 3000 and the adapter on port 3001. Run with:

```bash
node scripts/quickstart-listeners.js
```

- scripts/send-stub-webhook.js: sends a sample webhook POST to the stub (defaults to http://localhost:3000/raydium-webhook). Run with:

```bash
node scripts/send-stub-webhook.js
# or
WEBHOOK_URL=http://localhost:3000/raydium-webhook node scripts/send-stub-webhook.js
```

Notes

- The scripts are dependency-free and optional. They rely on local modules under src/listener when available.
- The quickstart script listens for SIGINT/SIGTERM and attempts to stop both servers gracefully.
- These files are intended to make review and manual testing easier without provisioning external services.

If you need more advanced testing or automated suites, integrate the listener code into your existing test harness.