// Convenience quickstart script to run the webhook stub and adapter locally.
// Usage: node scripts/quickstart-listeners.js

(async () => {
  try {
    const { startRaydiumWebhook } = require('../src/listener/raydiumWebhook');
    const { startWebhookAdapter } = require('../src/listener/raydiumWebhookAdapter');

    const webhook = await startRaydiumWebhook({ port: 3000, onCandidate: async (c) => console.log('webhook candidate', c) });
    console.log('webhook url:', webhook.url);

    const adapter = await startWebhookAdapter({ port: 3001, onCandidate: async (c) => console.log('adapter candidate', c) });
    console.log('adapter url:', adapter.url);

    console.log('Quickstart running. Press Ctrl+C to exit.');

    const stop = async () => {
      try { if (adapter && adapter.stop) await adapter.stop(); } catch (e) { /* ignore */ }
      try { if (webhook && webhook.stop) await webhook.stop(); } catch (e) { /* ignore */ }
      process.exit(0);
    };

    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (err) {
    console.error('Failed to start quickstart:', err);
    process.exit(1);
  }
})();