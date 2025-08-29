#!/usr/bin/env node
// src/webhook-server.ts
// Standalone Express server for QuickNode webhooks (alternative to Next.js API route)

import express from 'express';
import quicknodeRouter from './webhooks/quicknode-express';

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    service: 'firefly-webhook-server',
    timestamp: new Date().toISOString()
  });
});

// Mount webhook routes
app.use('/api/webhooks', quicknodeRouter);
app.use('/webhooks', quicknodeRouter); // Alternative path

// Start server
app.listen(port, () => {
  console.log(`🔥 Firefly webhook server running on port ${port}`);
  console.log(`📡 QuickNode webhook endpoint: http://localhost:${port}/api/webhooks/quicknode`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log(`🔧 Configuration:`);
  console.log(`   - HMAC enabled: ${!!process.env.QUICKNODE_WEBHOOK_SECRET}`);
  console.log(`   - Redis enabled: ${!!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)}`);
  console.log(`   - RPC probe enabled: ${!!process.env.QUICKNODE_RPC_URL}`);
});

export default app;