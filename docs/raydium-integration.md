# Raydium Paper‑MVP — Minimal runbook (opt-in)

This repository contains a minimal, opt‑in set of components to build a Raydium "paper trade" pipeline. These components are intentionally small so they can be reviewed and merged independently before provisioning external services (QuickNode, webhook providers, Redis, etc.).

Status (draft PRs)
- deep-fetcher: PR #20
- price-validator: PR #21
- integration bootstrap: PR #22
- webhook receiver stub: PR #23
- webhook → pipeline adapter: PR #24

Goals of this document
- Explain how to run the minimal pieces locally for manual review.
- Show example commands to exercise the webhook and adapter without external infrastructure.
- Make clear which parts are optional and which runtime hints are required when we later provision QuickNode/webhooks.

Running locally (no external APIs required)

1) Install dependencies and build (if needed)

  - npm install
  - npm run build

2) Start the webhook receiver stub (fast, dependency‑free)

  ```js
  // node REPL or small script
  const { startRaydiumWebhook } = require('./src/listener/raydiumWebhook');
  (async () => {
    const server = await startRaydiumWebhook({ port: 3000, onCandidate: async (c) => console.log('candidate', c) });
    console.log('webhook url:', server.url);
    // stop with await server.stop()
  })();
  ```

  Test with curl:

  ```bash
  curl -X POST -H 'Content-Type: application/json' --data '{"example":true}' http://localhost:3000/raydium-webhook
  ```

3) Start the webhook → pipeline adapter (will try to start internal pipeline if available)

  ```js
  const { startWebhookAdapter } = require('./src/listener/raydiumWebhookAdapter');
  (async () => {
    const adapter = await startWebhookAdapter({ port: 0, onCandidate: async (c) => console.log('adapter got', c) });
    console.log('adapter url:', adapter.url);
    // POST to adapter.url as above
    // stop with await adapter.stop()
  })();
  ```

  If deep-fetcher is available and the related PRs are merged, the adapter will prefer forwarding to the pipeline methods (enqueueCandidate/processCandidate).

Notes on environment and provisioning
- No QuickNode or external webhook provider is required to review and test these PRs locally. The modules are designed to be optional and will fall back to no‑op handlers.
- When we later provision QuickNode or a webhook provider, we will only need to supply RPC URL and webhook endpoint strings. The code is structured to accept those via options (rpcUrl, port, path, origin, etc.).

Testing checklist for reviewers
- Start the webhook stub and POST a valid JSON payload; verify the onCandidate callback receives it and server responds 200.
- Start the adapter with an onCandidate fallback and POST; verify forwarding.
- Start the adapter with no onCandidate and with deep-fetcher merged; verify pipeline receives candidates (when the deep-fetcher PRs are merged).

Next steps
- Provision QuickNode and webhook provider (deferred until code has been reviewed).
- Add optional Redis or durable queue for candidate persistence (only if needed).

If you want, I can also add a short README snippet into src/listener/README.md pointing to this document.