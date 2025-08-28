#!/usr/bin/env ts-node

/**
 * Example usage of the Raydium WebSocket listener
 * 
 * This script demonstrates how to use the raydiumListener module.
 * Set the required environment variables before running:
 * 
 * QUICKNODE_RPC_URL=wss://your-quicknode-endpoint
 * RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
 * RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
 * UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint (optional)
 * UPSTASH_REDIS_REST_TOKEN=your-upstash-token (optional)
 * 
 * Usage:
 * npm run dev:raydium-example
 */

import { startRaydiumListener, stopRaydiumListener } from '../src/listener/raydiumListener';

async function main() {
  console.log('Starting Raydium WebSocket Listener...');
  
  // Custom callback to handle candidate events
  const handleCandidate = async (candidate: any) => {
    console.log('🎯 New candidate detected!');
    console.log('  Signature:', candidate.meta.signature);
    console.log('  Slot:', candidate.meta.slot);
    console.log('  Logs count:', candidate.logs.length);
    console.log('  First log preview:', candidate.logs[0]?.substring(0, 100) + '...');
  };

  // Start the listener with our custom handler
  await startRaydiumListener(handleCandidate);
  
  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n🛑 Shutting down Raydium listener...');
    stopRaydiumListener();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  console.log('✅ Raydium listener is running. Press Ctrl+C to stop.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error starting Raydium listener:', error);
    process.exit(1);
  });
}