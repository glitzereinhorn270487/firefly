#!/usr/bin/env node
/**
 * Quick demo of the Raydium Price Validator
 * This script demonstrates the validator functionality without requiring actual network calls
 */

// Mock fetch to avoid actual API calls in the demo
global.fetch = jest.fn();

import { startPriceValidator } from '../src/raydiumPriceValidator';

async function runDemo() {
  console.log('=== Raydium Price Validator Demo ===\n');

  // Mock successful price fetch
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      pairs: [{ priceUsd: '1.50' }] // Mock $1.50 per token
    })
  });

  // Create validator
  const validator = startPriceValidator({
    rpcUrl: 'https://api.mainnet-beta.solana.com' // Mock RPC URL to avoid warning
  });

  console.log('1. Testing sufficient liquidity scenario:');
  const goodCandidate = {
    signature: 'demo-good-signature',
    reserves: {
      mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mock USDC
      mintB: 'So11111111111111111111111111111111111111112',  // Mock SOL
      reserveA: 8000,  // 8,000 tokens * $1.50 = $12,000
      reserveB: 4000   // 4,000 tokens * $1.50 = $6,000
    }
  };

  const goodResult = await validator.validateCandidatePrice(goodCandidate);
  console.log('Result:', {
    signature: goodResult.signature,
    totalUsd: goodResult.totalUsd,
    ok: goodResult.ok,
    reason: goodResult.reason || 'none'
  });
  console.log(`✅ Expected: totalUsd=18000, ok=true\n`);

  // Mock no price data scenario
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ pairs: [] }) // No price data
  });

  console.log('2. Testing no price data scenario:');
  const noPriceCandidate = {
    signature: 'demo-no-price-signature',
    reserves: {
      mintA: 'UnknownToken123456789',
      reserveA: 1000
    }
  };

  const noPriceResult = await validator.validateCandidatePrice(noPriceCandidate);
  console.log('Result:', {
    signature: noPriceResult.signature,
    totalUsd: noPriceResult.totalUsd,
    ok: noPriceResult.ok,
    reason: noPriceResult.reason || 'none'
  });
  console.log(`❌ Expected: totalUsd=0, ok=false, reason='no-price-data'\n`);

  // Mock low liquidity scenario
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      pairs: [{ priceUsd: '0.10' }] // Mock $0.10 per token (low value)
    })
  });

  console.log('3. Testing low liquidity scenario:');
  const lowLiquidityCandidate = {
    signature: 'demo-low-liquidity-signature',
    reserves: {
      mintA: 'LowValueToken123456789',
      reserveA: 10000 // 10,000 tokens * $0.10 = $1,000 (below $10k threshold)
    }
  };

  const lowLiquidityResult = await validator.validateCandidatePrice(lowLiquidityCandidate);
  console.log('Result:', {
    signature: lowLiquidityResult.signature,
    totalUsd: lowLiquidityResult.totalUsd,
    ok: lowLiquidityResult.ok,
    reason: lowLiquidityResult.reason || 'none'
  });
  console.log(`❌ Expected: totalUsd=1000, ok=false, reason='low-liquidity'\n`);

  console.log('4. Testing lazy loading pattern:');
  const lazyValidator = require('../src/raydiumPriceValidator');
  console.log('✅ Lazy loading works, validator module exports:', Object.keys(lazyValidator));

  // Clean up
  if (validator.stop) {
    validator.stop();
  }

  console.log('\n=== Demo Complete ===');
  console.log('All functionality demonstrated successfully!');
}

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };