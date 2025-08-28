/* Minimal webhook receiver stub for Raydium pipeline.
   - Accepts POST requests with JSON bodies at a configurable path (default: /raydium-webhook).
   - Forwards parsed payloads to options.onCandidate(payload) if provided.
   - Returns { url, stop() } where stop() closes the server.

   This module is intentionally tiny and dependency-free so it can be reviewed and merged
   before provisioning the external webhook provider or QuickNode access.
*/

import { createServer, IncomingMessage, ServerResponse } from 'http';

export async function startRaydiumWebhook(options?: {
  port?: number;
  path?: string;
  // Called for each incoming candidate payload. Default no-op.
  onCandidate?: (payload: any) => Promise<void> | void;
}) {
  const port = options?.port ?? 0; // 0 => random available port for tests
  const path = options?.path ?? '/raydium-webhook';
  const onCandidate = options?.onCandidate ?? (async () => {});

  function readJson(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        if (!raw) return resolve(null);
        try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
      });
      req.on('error', reject);
    });
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST' || req.url !== path) {
        res.statusCode = 404;
        return res.end('Not found');
      }

      let payload;
      try {
        payload = await readJson(req);
      } catch (err) {
        res.statusCode = 400;
        return res.end('Invalid JSON');
      }

      // Fire-and-forget the callback but catch errors to avoid crashing the server
      try {
        const maybe = onCandidate(payload);
        if (maybe && typeof (maybe as Promise<any>).then === 'function') await maybe;
      } catch (err) {
        // swallow — we still respond 200 to the sender but log for visibility
        // eslint-disable-next-line no-console
        console.error('[raydium-webhook] onCandidate handler error:', err);
      }

      res.statusCode = 200;
      res.end('ok');
    } catch (err) {
      // unexpected
      // eslint-disable-next-line no-console
      console.error('[raydium-webhook] unexpected error:', err);
      try { res.statusCode = 500; res.end('error'); } catch (e) {}
    }
  });

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', () => resolve()));
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const url = `http://localhost:${actualPort}${path}`;

  return {
    url,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}