/**
 * Example integration of metrics with webhook handler
 * This shows how to use the metrics health endpoints alongside the webhook receiver
 * Run this instead of webhook_handler.ts to get both webhook and metrics endpoints
 */
import express from 'express';
import bodyParser from 'body-parser';
import metricsApp, { incrementErrorCount, getMetrics } from './metrics/health';

const app = express();
app.use(bodyParser.json({ limit: '200kb' }));

const PORT = Number(process.env.PORT || 3000);
const METRICS_PORT = Number(process.env.METRICS_PORT || 3001);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MODE = process.env.MODE || 'paper';

if (!WEBHOOK_SECRET) {
  console.error('WEBHOOK_SECRET not set');
  process.exit(1);
}

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${WEBHOOK_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Main webhook endpoint with metrics integration
app.post('/webhook', authMiddleware, async (req, res) => {
  const payload = req.body;
  const { eventType, signature, slot, txSummary } = payload || {};
  if (!eventType || !signature) return res.status(400).json({ error: 'invalid payload' });

  try {
    if (MODE === 'paper') {
      // Simulate: log but don't broadcast txs
      console.log(`[PAPER] ${eventType} - ${signature} slot:${slot}`, txSummary ? { fee: txSummary.fee } : null);
      // add simulation logic / compute hypothetical fills here
    } else {
      // Live: enqueue execution job (not implemented here)
      console.log(`[LIVE] ${eventType} - queued for execution`, signature);
      // TODO: verify txSummary, double-check burned mint == known LP mint, then create & sign tx
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook handler error', err);
    incrementErrorCount(); // Track errors in metrics
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Add a simple status endpoint that includes metrics info
app.get('/status', (req, res) => {
  const metrics = getMetrics();
  res.json({
    service: 'webhook-handler',
    mode: MODE,
    metrics,
    timestamp: new Date().toISOString(),
  });
});

// Start main webhook server
const webhookServer = app.listen(PORT, () => {
  console.log(`Webhook receiver listening on ${PORT} in ${MODE} mode`);
});

// Start metrics server on different port
const metricsServer = metricsApp.listen(METRICS_PORT, () => {
  console.log(`Metrics endpoints available on port ${METRICS_PORT}`);
  console.log(`  Health: http://localhost:${METRICS_PORT}/health`);
  console.log(`  Ready: http://localhost:${METRICS_PORT}/ready`);
  console.log(`  Metrics: http://localhost:${METRICS_PORT}/metrics`);
  console.log(`  Status: http://localhost:${PORT}/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  webhookServer.close();
  metricsServer.close();
});