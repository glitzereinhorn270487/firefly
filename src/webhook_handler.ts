/**
 * Minimal webhook receiver (Express example)
 * - Validates Bearer token
 * - Handles three event types: raydium_pool_initialize, token_setauthority_revoked, raydium_liquidity_burn_candidate
 * - In paper mode it simulates trades, in live mode it enqueues actual trade executions
 *
 * ENV:
 * - PORT
 * - WEBHOOK_SECRET (Bearer token expected)
 * - MODE ('paper' or 'live')
 */
import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json({ limit: '200kb' }));

const PORT = Number(process.env.PORT || 3000);
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

app.post('/webhook', authMiddleware, async (req, res) => {
  const payload = req.body;
  const { eventType, signature, slot, txSummary } = payload || {};
  if (!eventType || !signature) return res.status(400).json({ error: 'invalid payload' });

  try {
    if (MODE === 'paper') {
      // Simulate: log but don't broadcast txs
      console.log('[PAPER] %s - %s slot:%s', eventType, signature, slot, txSummary ? { fee: txSummary.fee } : null);
      // add simulation logic / compute hypothetical fills here
    } else {
      // Live: enqueue execution job (not implemented here)
      console.log('[LIVE] %s - queued for execution', eventType, signature);
      // TODO: verify txSummary, double-check burned mint == known LP mint, then create & sign tx
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook handler error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on ${PORT} in ${MODE} mode`);
});
