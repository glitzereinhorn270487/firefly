// Example usage of the Raydium Price Validator
// This demonstrates how deep-fetcher or other modules can use the validator

import { startPriceValidator } from '../raydiumPriceValidator';
import { redisGet, redisSet } from '../clients/redisClient';

// Example of lazy loading the validator as described in the problem statement
function lazyLoadValidator() {
  return require('../raydiumPriceValidator');
}

// Example usage with Redis integration
async function exampleUsage() {
  console.log('[example] Starting Raydium price validator with Redis integration...');
  
  // Start the validator with Redis helpers
  const validator = startPriceValidator({
    redisGet,
    redisSet,
    rpcUrl: process.env.QUICKNODE_RPC_URL || process.env.RPC_URL
  });

  // Example validation of a candidate transaction
  const exampleCandidate = {
    signature: '5J7d3b2VrXqGrS8qB1EuHkNjRmBtCwPv4xYzAiFsWeLp',
    reserves: {
      mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      mintB: 'So11111111111111111111111111111111111111112',  // SOL
      reserveA: 50000,  // 50,000 USDC
      reserveB: 250     // 250 SOL
    }
  };

  try {
    console.log('[example] Validating candidate:', exampleCandidate.signature);
    
    const result = await validator.validateCandidatePrice(exampleCandidate);
    
    console.log('[example] Validation result:', {
      signature: result.signature,
      totalUsd: result.totalUsd,
      ok: result.ok,
      reason: result.reason || 'none'
    });

    if (result.ok) {
      console.log(`[example] ✅ Candidate passed validation with $${result.totalUsd.toFixed(2)} total liquidity`);
    } else {
      console.log(`[example] ❌ Candidate failed validation: ${result.reason}`);
    }

  } catch (error) {
    console.error('[example] Error during validation:', error);
  }

  // Clean up resources
  if (validator.stop) {
    validator.stop();
  }
}

// Example of how to handle low-liquidity scenarios
async function exampleLowLiquidity() {
  console.log('\n[example] Testing low liquidity scenario...');
  
  const validator = startPriceValidator();
  
  const lowLiquidityCandidate = {
    signature: 'test-low-liquidity',
    reserves: {
      mintA: 'SomeUnknownTokenMint123456789',
      reserveA: 1000
    }
  };

  const result = await validator.validateCandidatePrice(lowLiquidityCandidate);
  console.log('[example] Low liquidity result:', result);
  
  if (validator.stop) {
    validator.stop();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('=== Raydium Price Validator Examples ===\n');
  
  exampleUsage()
    .then(() => exampleLowLiquidity())
    .then(() => {
      console.log('\n[example] All examples completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n[example] Example failed:', error);
      process.exit(1);
    });
}

export { lazyLoadValidator };