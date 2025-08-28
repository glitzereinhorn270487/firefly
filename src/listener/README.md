# Listener components (minimal, opt-in)

This directory contains lightweight, optional listener helpers used by the Raydium paper‑MVP integration.

See the full runbook for details and testing instructions:

- docs/raydium-integration.md

Quickstart examples

Start the webhook stub locally:

```js
const { startRaydiumWebhook } = require('../../src/listener/raydiumWebhook');
(async () => {
  const server = await startRaydiumWebhook({ port: 3000, onCandidate: async (c) => console.log('candidate', c) });
  console.log('webhook url:', server.url);
  // await server.stop() to stop
})();
```

Start the webhook → pipeline adapter (will try to start internal pipeline if available):

```js
const { startWebhookAdapter } = require('../../src/listener/raydiumWebhookAdapter');
(async () => {
  const adapter = await startWebhookAdapter({ port: 0, onCandidate: async (c) => console.log('adapter got', c) });
  console.log('adapter url:', adapter.url);
  // await adapter.stop() to stop
})();
```

Notes

- These components are optional; no external provisioning (QuickNode, webhook provider) is required to review the code. See docs/raydium-integration.md for more info.