/* Lightweight integration bootstrap that composes the deep-fetcher and price-validator.
   This module is intentionally minimal: it tries to start the price-validator lazily
   (if the module exists), and passes the validator to the deep-fetcher so the
   deep-fetcher can use the validator for USD estimation.

   Usage (approx):
     const { startRaydiumPipeline } = require('./listener/raydiumIntegration');
     const pipeline = await startRaydiumPipeline({ rpcUrl: process.env.RPC_URL, redis });
     // pipeline has stop() to shutdown gracefully
*/

type PriceValidator = { validateCandidatePrice: (c:any)=>Promise<any>; stop?: ()=>Promise<void> } | null;

export async function startRaydiumPipeline(options?: {
  rpcUrl?: string;
  redis?: { redisGet?: (k:string)=>Promise<any>; redisSet?: (k:string,v:any,opts?:any)=>Promise<any> } | null;
  // If provided, use this price validator instance instead of attempting to start internal one
  priceValidator?: PriceValidator;
}) {
  const rpcUrl = options?.rpcUrl;
  const redis = options?.redis ?? null;
  let priceValidator: PriceValidator = options?.priceValidator ?? null;
  let startedInternalPriceValidator = false;

  // Try to start internal price validator if not provided
  async function tryStartPriceValidator() {
    if (priceValidator) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const mod = require('./raydiumPriceValidator');
      if (mod && typeof mod.startPriceValidator === 'function') {
        priceValidator = await mod.startPriceValidator({ rpcUrl, redis });
        startedInternalPriceValidator = true;
      }
    } catch (err) {
      // Not fatal — price validator is optional
      // console.debug('[integration] no internal price validator available:', err?.message || err);
    }
  }

  // Start price validator (best-effort) before starting deep-fetcher to ensure it's ready
  await tryStartPriceValidator();

  // Start deep-fetcher and pass the priceValidator instance if available
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const deepMod = require('./raydiumDeepFetcher');
  if (!deepMod || typeof deepMod.startDeepFetcher !== 'function') {
    throw new Error('deep-fetcher module not found or invalid');
  }

  const deepFetcher = deepMod.startDeepFetcher({ rpcUrl, connection: undefined as any, redis, priceValidator });

  async function stop() {
    // stop deep-fetcher
    try { if (deepFetcher && typeof deepFetcher.stop === 'function') await deepFetcher.stop(); } catch (e) {}
    // stop internal price validator if we started it here
    if (startedInternalPriceValidator && priceValidator && typeof priceValidator.stop === 'function') {
      try { await priceValidator.stop(); } catch (e) {}
    }
  }

  return { stop };
}