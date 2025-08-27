#!/usr/bin/env node
/**
 * Manual test script for the new PR7 functionality
 */

import { shouldSample } from '../dist/filters/sampling.js';
import { getLogger } from '../dist/logging/logger.js';
import { PaperTrader } from '../dist/trading/paperTrader.js';

async function testSampling() {
  console.log('🧪 Testing deterministic sampling...');
  
  // Test edge cases
  console.log('Edge case tests:');
  console.log(`shouldSample("test", 0): ${shouldSample("test", 0)} (should be false)`);
  console.log(`shouldSample("test", 1): ${shouldSample("test", 1)} (should be true)`);
  
  // Test deterministic behavior
  const identifier = "user123";
  const rate = 0.5;
  const result1 = shouldSample(identifier, rate);
  const result2 = shouldSample(identifier, rate);
  console.log(`Deterministic test - same input gives same result: ${result1 === result2} (should be true)`);
  
  // Test distribution (approximate)
  const testIds = Array.from({length: 1000}, (_, i) => `user${i}`);
  const sampled = testIds.filter(id => shouldSample(id, 0.3)).length;
  const expectedRange = [250, 350]; // approximately 30% ± some variance
  console.log(`Distribution test (30% rate): ${sampled}/1000 sampled (expected ~300)`);
  
  console.log('✅ Sampling tests completed\n');
}

async function testLogging() {
  console.log('🧪 Testing structured logging...');
  
  const logger = getLogger('test-module');
  
  console.log('Testing different log levels:');
  logger.info('test_info_event', { userId: 'user123', action: 'login' });
  logger.warn('test_warning_event', { threshold: 100, current: 150 });
  logger.error('test_error_event', { error: 'Sample error', code: 500 });
  logger.debug('test_debug_event', { debugInfo: 'verbose details' });
  
  console.log('✅ Logging tests completed\n');
}

async function testPaperTrader() {
  console.log('🧪 Testing paper trader...');
  
  const trader = new PaperTrader('test-run-123');
  
  // Test buy order
  console.log('Testing buy order:');
  const buyResult = await trader.placeOrder({
    side: 'buy',
    qty: 100,
    price: 1.5,
    symbol: 'TEST'
  });
  console.log('Buy result:', buyResult);
  
  // Test invalid order
  console.log('Testing invalid order:');
  const invalidResult = await trader.placeOrder({
    side: 'buy',
    qty: -10, // invalid quantity
    price: 1.0,
    symbol: 'TEST'
  });
  console.log('Invalid order result:', invalidResult);
  
  // Check positions
  const positions = await trader.getPositions();
  console.log(`Current positions: ${positions.length}`);
  
  // Test sell order
  if (positions.length > 0) {
    console.log('Testing sell order:');
    const sellResult = await trader.placeOrder({
      side: 'sell',
      qty: 50,
      price: 1.8,
      symbol: 'TEST'
    });
    console.log('Sell result:', sellResult);
    
    const updatedPositions = await trader.getPositions();
    console.log(`Positions after sell: ${updatedPositions.length}`);
  }
  
  console.log('✅ Paper trader tests completed\n');
}

async function runTests() {
  console.log('🚀 Starting PR7 functionality tests...\n');
  
  try {
    await testSampling();
    await testLogging();
    await testPaperTrader();
    
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();