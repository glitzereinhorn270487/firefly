# Raydium Paper‑MVP — Environment examples (opt-in)

This file contains minimal environment variable examples for running the Raydium paper‑MVP components locally. All variables are optional for review — if left blank, the code falls back to in‑process stubs and local defaults.

.env variables

- RPC_URL — Optional. An RPC endpoint (QuickNode, Alchemy, etc.) to use for on‑chain reads. Leave empty to run with stub/local defaults.
- REDIS_URL — Optional. Connection string for Redis if you want durable queues. Leave empty to run without Redis.
- WEBHOOK_PORT — Port for the webhook receiver (default: 3000).
- WEBHOOK_PATH — Path for the webhook receiver (default: /raydium-webhook).
- LOG_LEVEL — Optional logging verbosity (info, debug, warn, error).

Quickstart (example usage)

1) Copy the example env file:

```bash
cp .env.example .env
```

2) Start the webhook stub using env vars in a node REPL or small script:

```js
// node REPL or script
process.env.RPC_URL = process.env.RPC_URL || '';
process.env.REDIS_URL = process.env.REDIS_URL || '';
const { startRaydiumWebhook } = require('../src/listener/raydiumWebhook');
(async () => {
  const server = await startRaydiumWebhook({ port: parseInt(process.env.WEBHOOK_PORT || '3000'), path: process.env.WEBHOOK_PATH });
  console.log('webhook url:', server.url);
  // await server.stop()
})();
```

3) Start the webhook → pipeline adapter using env hints (adapter will try to use RPC_URL/REDIS_URL when starting internal pipeline):

```js
// node REPL or script
const { startWebhookAdapter } = require('../src/listener/raydiumWebhookAdapter');
(async () => {
  const adapter = await startWebhookAdapter({ port: parseInt(process.env.WEBHOOK_PORT || '0'), rpcUrl: process.env.RPC_URL, redis: process.env.REDIS_URL, onCandidate: async (c) => console.log('got', c) });
  console.log('adapter url:', adapter.url);
  // await adapter.stop()
})();
```

Notes

- No QuickNode or external webhook provisioning required to review these PRs — leave RPC_URL empty to exercise local stubs.
- These environment variables are optional hints for reviewers running components locally or for future provisioning.

References: see docs/raydium-integration.md and draft PRs #20, #21, #22, #23, #24.