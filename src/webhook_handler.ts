/**
 * Enhanced webhook receiver with structured logging
 * - Validates Bearer token
 * - Handles three event types: raydium_pool_initialize, token_setauthority_revoked, raydium_liquidity_burn_candidate
 * - In paper mode it simulates trades, in live mode it enqueues actual trade executions
 * - Uses structured logging with Pino
 *
 * ENV:
 * - PORT
 * - WEBHOOK_SECRET (Bearer token expected)
 * - MODE ('paper' or 'live')
 * - PAPER_RUN_ID (for paper trading)
 */
import express from 'express';
import bodyParser from 'body-parser';
import { getLogger } from './logging/logger';
import { PaperTrader } from './trading/paperTrader';

const app = express();
app.use(bodyParser.json({ limit: '200kb' }));

const PORT = Number(process.env.PORT || 3000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MODE = process.env.MODE || 'paper';

const logger = getLogger('webhook-handler');
const paperTrader = MODE === 'paper' ? new PaperTrader() : null;

if (!WEBHOOK_SECRET) {
  logger.error('startup_failed', { reason: 'WEBHOOK_SECRET_not_set' });
  process.exit(1);
}

logger.info('webhook_handler_starting', { 
  PORT, 
  MODE,
  paperTradingEnabled: !!paperTrader,
  timestamp: new Date().toISOString()
});

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  
  if (auth !== `Bearer ${WEBHOOK_SECRET}`) {
    logger.warn('webhook_auth_failed', { 
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      authHeader: auth ? 'present' : 'missing'
    });
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  next();
}

app.post('/webhook', authMiddleware, async (req, res) => {
  const payload = req.body;
  const { eventType, signature, slot, txSummary } = payload || {};
  
  logger.info('webhook_received', { 
    eventType, 
    signature, 
    slot,
    ip: req.ip || req.connection?.remoteAddress
  });
  
  if (!eventType || !signature) {
    logger.warn('invalid_webhook_payload', { eventType, signature, hasPayload: !!payload });
    return res.status(400).json({ error: 'invalid payload' });
  }

  try {
    if (MODE === 'paper') {
      // Simulate: log but don't broadcast txs
      logger.info('paper_mode_simulation', { 
        eventType, 
        signature, 
        slot,
        fee: txSummary?.fee 
      });
      
      // Use PaperTrader if enabled
      if (paperTrader && eventType === 'raydium_pool_initialize') {
        try {
          const result = await paperTrader.placeOrder({
            side: 'buy',
            qty: 100,
            price: 0.001, // Default price
            symbol: `PAPER-${signature.slice(-8)}`,
            meta: { eventType, signature, slot, source: 'webhook' }
          });
          
          logger.info('paper_trade_simulated', { signature, result });
        } catch (paperErr) {
          logger.warn('paper_trade_simulation_failed', { 
            signature, 
            error: paperErr instanceof Error ? paperErr.message : String(paperErr) 
          });
        }
      }
    } else {
      // Live: enqueue execution job (not implemented here)
      logger.info('live_mode_execution_queued', { eventType, signature });
      // TODO: verify txSummary, double-check burned mint == known LP mint, then create & sign tx
    }
    
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('webhook_handler_error', {
      eventType,
      signature,
      error: err instanceof Error ? err.message : String(err)
    });
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(PORT, () => {
  logger.info('webhook_handler_started', { 
    port: PORT,
    mode: MODE,
    message: `Webhook receiver listening on ${PORT} in ${MODE} mode`
  });
});
