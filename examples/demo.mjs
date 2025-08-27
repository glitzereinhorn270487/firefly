#!/usr/bin/env node
/**
 * Example demonstrating the new PR7 features
 */

import { shouldSample } from '../dist/filters/sampling.js';
import { getLogger } from '../dist/logging/logger.js';
import { PaperTrader } from '../dist/trading/paperTrader.js';

// Set environment variables for demonstration
process.env.PAPER_RUN_ID = 'demo-run-123';
process.env.LOG_LEVEL = 'info';

async function demonstrateFeatures() {
  console.log('🚀 PR7 Features Demonstration\n');
  
  // 1. Deterministic Sampling
  console.log('📊 Deterministic Sampling:');
  const signatures = [
    '5J7ZjYwZq2FJ8Kx3p9R8mN4tL7W2Q6vB3A1s8D9fG0hC',
    '7R3mL9vK8pN4Q2sD1fG6hC5J8yW0zA9B7tE4xQ1mP6uV',
    '9W2pK7vQ1mN8fC3hG5J4yD9zA0B6tE1xR4mL8qS7uP3V'
  ];
  
  signatures.forEach(sig => {
    const sampled = shouldSample(sig, 0.5);
    console.log(`  ${sig.slice(0, 12)}... -> ${sampled ? '✓ sampled' : '✗ filtered'}`);
  });
  
  // 2. Structured Logging
  console.log('\n📝 Structured Logging:');
  const logger = getLogger('demo');
  logger.info('demo_started', { 
    userId: 'user123', 
    action: 'demonstration',
    features: ['sampling', 'logging', 'paper-trading']
  });
  logger.warn('sample_warning', { threshold: 100, current: 150 });
  
  // 3. Paper Trading
  console.log('\n💰 Paper Trading:');
  const trader = new PaperTrader('demo-run-123');
  
  // Place a buy order
  const buyOrder = await trader.placeOrder({
    side: 'buy',
    qty: 100,
    price: 1.25,
    symbol: 'DEMO',
    meta: { source: 'demonstration' }
  });
  
  console.log('  Buy order result:', {
    id: buyOrder.id,
    status: buyOrder.status,
    filled: `${buyOrder.filledQty}@${buyOrder.filledPrice}`
  });
  
  // Check positions
  const positions = await trader.getPositions();
  console.log(`  Current positions: ${positions.length}`);
  
  // Place a sell order
  const sellOrder = await trader.placeOrder({
    side: 'sell',
    qty: 50,
    price: 1.40,
    symbol: 'DEMO'
  });
  
  console.log('  Sell order result:', {
    id: sellOrder.id,
    status: sellOrder.status,
    filled: sellOrder.status === 'filled' ? `${sellOrder.filledQty}@${sellOrder.filledPrice}` : 'N/A'
  });
  
  logger.info('demo_completed', { 
    totalOrders: 2, 
    successful: [buyOrder.status, sellOrder.status].filter(s => s === 'filled').length
  });
  
  console.log('\n✅ Demonstration completed!');
  console.log('\n📋 How to use in your environment:');
  console.log('   - Set SAMPLE_RATE (0.0-1.0) to control event sampling');
  console.log('   - Set PAPER_TRADER_ENABLED=true to enable paper trading');
  console.log('   - Set PAPER_RUN_ID to identify your trading session');
  console.log('   - Set LOG_LEVEL (debug/info/warn/error) to control logging verbosity');
}

demonstrateFeatures().catch(console.error);