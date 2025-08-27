// Vercel / Next.js Serverless API handler
// Deploy this file to your Vercel project under /api/webhook
import { VercelRequest, VercelResponse } from '@vercel/node';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MODE = process.env.MODE || 'paper';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = req.headers.authorization;
  if (!WEBHOOK_SECRET || auth !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const payload = req.body;
    const { eventType, signature, slot, txSummary } = payload || {};
    if (!eventType || !signature) return res.status(400).json({ error: 'invalid_payload' });

    if (MODE === 'paper') {
      console.log(`[PAPER] ${eventType} - ${signature} slot:${slot}`, txSummary ? { fee: txSummary.fee } : null);
      // simulate logic here
    } else {
      console.log(`[LIVE] ${eventType} - queued for execution`, signature);
      // enqueue real execution (not implemented here)
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook handler error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}