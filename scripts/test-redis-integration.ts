/**
 * Test script to verify Redis integration and fallback behavior
 */

import { kvGet, kvSet, isUsingRedis } from '@/lib/store/redisStore';

async function testRedisIntegration() {
  console.log('Testing Redis integration...');
  console.log('Using Redis:', isUsingRedis());
  
  // Test basic key-value operations
  const testKey = 'test:redis-integration';
  const testValue = { message: 'Hello from Redis!', timestamp: Date.now() };
  
  try {
    console.log('Setting test value...');
    await kvSet(testKey, testValue);
    
    console.log('Getting test value...');
    const retrieved = await kvGet(testKey);
    
    console.log('Retrieved value:', retrieved);
    
    if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
      console.log('✅ Redis integration test passed!');
    } else {
      console.log('❌ Redis integration test failed - values do not match');
    }
  } catch (error) {
    console.error('❌ Redis integration test failed with error:', error);
  }
}

// Test paper trading position storage
async function testPaperTradingIntegration() {
  console.log('\nTesting paper trading position storage...');
  
  const positionKey = 'positions:test';
  const testPosition = {
    id: 'test-position-1',
    chain: 'SOL' as const,
    name: 'Test Token',
    category: 'Test' as const,
    investmentUsd: 100,
    status: 'open' as const,
    openedAt: Date.now()
  };
  
  try {
    await kvSet(positionKey, testPosition);
    const retrieved = await kvGet(positionKey);
    
    console.log('Position stored and retrieved successfully:', retrieved);
    console.log('✅ Paper trading integration test passed!');
  } catch (error) {
    console.error('❌ Paper trading integration test failed:', error);
  }
}

async function main() {
  await testRedisIntegration();
  await testPaperTradingIntegration();
}

main().catch(console.error);