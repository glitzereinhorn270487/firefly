/* Adapter that wires the lightweight webhook receiver to the Raydium pipeline (deep-fetcher).
   - Minimal and opt-in: will only start internal components if not provided via options.
   - Forwarding strategy (in order): provided onCandidate callback -> internal pipeline.enqueueCandidate/processCandidate if available -> log and ignore.

   Usage:
     const { startWebhookAdapter } = require('./listener/raydiumWebhookAdapter');
     const adapter = await startWebhookAdapter({ port: 3000 });
     // adapter.url is the POST endpoint to hit; adapter.stop() to clean up
*/

import type { Server } from 'http';

type PipelineLike = {
  enqueueCandidate?: (c: any) => Promise<void> | void;
  processCandidate?: (c: any) => Promise<void> | void;
  stop?: () => Promise<void> | void;
} | null;

export async function startWebhookAdapter(options?: {
  port?: number;
  path?: string;
  // If provided, use this webhook instance instead of starting an internal one
  webhookInstance?: { url: string; stop: () => Promise<void> | void } | null;
  // If provided, use this pipeline instance instead of starting an internal one
  pipeline?: PipelineLike;
  // Fallback candidate handler
  onCandidate?: (payload: any) => Promise<void> | void;
  // If adapter should try to start an internal pipeline, provide runtime hints
  rpcUrl?: string;
  redis?: any;
}) {
  const port = options?.port ?? 0;
  const path = options?.path;
  const onCandidateFallback = options?.onCandidate;
  let webhook = options?.webhookInstance ?? null;
  let pipeline: PipelineLike = options?.pipeline ?? null;
  let startedInternalWebhook = false;
  let startedInternalPipeline = false;

  async function forwardCandidate(payload: any) {
    // prefer explicit fallback handler
    if (onCandidateFallback) {
      try { await onCandidateFallback(payload); return; } catch (err) {
        // swallow to keep behavior resilient
        // eslint-disable-next-line no-console
        console.error('[webhook-adapter] onCandidate handler error:', err);
      }
    }

    if (pipeline) {
      try {
        if (typeof pipeline.enqueueCandidate === 'function') {
          await pipeline.enqueueCandidate(payload);
          return;
        }
        if (typeof pipeline.processCandidate === 'function') {
          await pipeline.processCandidate(payload);
          return;
        }
        // pipeline present but has no known forward method
        // eslint-disable-next-line no-console
        console.warn('[webhook-adapter] pipeline started but has no enqueueCandidate/processCandidate - payload ignored');
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webhook-adapter] error forwarding to pipeline:', err);
        return;
      }
    }

    // Nothing to do with the payload
    // eslint-disable-next-line no-console
    console.info('[webhook-adapter] candidate received but no pipeline or handler configured');
  }

  // Start internal pipeline if none provided
  async function tryStartPipeline() {
    if (pipeline) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const deep = require('./raydiumDeepFetcher');
      if (deep && typeof deep.startDeepFetcher === 'function') {
        pipeline = await deep.startDeepFetcher({ rpcUrl: options?.rpcUrl, connection: undefined as any, redis: options?.redis });
        startedInternalPipeline = true;
      }
    } catch (err) {
      // Not fatal — pipeline is optional here
      // eslint-disable-next-line no-console
      console.debug('[webhook-adapter] could not start internal pipeline:', (err as Error)?.message || err);
    }
  }

  // Start webhook if not provided
  async function tryStartWebhook() {
    if (webhook) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const whMod = require('./raydiumWebhook');
      if (whMod && typeof whMod.startRaydiumWebhook === 'function') {
        webhook = await whMod.startRaydiumWebhook({ port, path, onCandidate: forwardCandidate });
        startedInternalWebhook = true;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('[webhook-adapter] no internal webhook available:', (err as Error)?.message || err);
    }
  }

  await tryStartPipeline();
  await tryStartWebhook();

  const url = webhook?.url ?? `http://localhost:${port}${path ?? '/raydium-webhook'}`;

  return {
    url,
    stop: async () => {
      // stop webhook if started
      try { if (startedInternalWebhook && webhook && typeof webhook.stop === 'function') await webhook.stop(); } catch (e) {}
      // stop pipeline if started
      try { if (startedInternalPipeline && pipeline && typeof pipeline.stop === 'function') await pipeline.stop(); } catch (e) {}
    }
  };
}