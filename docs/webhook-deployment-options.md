# QuickNode Webhook Deployment Options

This project provides two webhook deployment options for production environments:

## Option 1: Next.js API Route (Recommended for Vercel/Next.js deployments)

Location: `app/api/webhooks/quicknode/route.ts`

**Requirements:**
- Next.js environment with `next/server` support
- Suitable for Vercel, Netlify, or other Next.js hosting platforms

**Usage:**
```bash
# Deploy as part of Next.js application
npm run build  # If Next.js dependencies are installed
```

**Endpoint:** `https://your-app.vercel.app/api/webhooks/quicknode`

## Option 2: Express Server (Recommended for Node.js deployments)

Location: `src/webhook-server.ts` + `src/webhooks/quicknode-express.ts`

**Requirements:**
- Node.js environment with Express
- Suitable for VPS, Docker, cloud instances

**Usage:**
```bash
# Development
npm run dev:webhook-server

# Production
npm run build:all
npm run start:webhook-server
```

**Endpoints:**
- Webhook: `http://localhost:3000/api/webhooks/quicknode`
- Health: `http://localhost:3000/health`

## Feature Parity

Both implementations provide identical functionality:

✅ HMAC signature verification with `QUICKNODE_WEBHOOK_SECRET`  
✅ Program ID and factory address whitelisting  
✅ Token whitelist support  
✅ Redis deduplication with in-memory fallback  
✅ Light on-chain liquidity probing  
✅ Async background processing  
✅ Comprehensive metrics and logging  

## Environment Variables

Both implementations use the same environment variables:

```bash
# Required
QUICKNODE_WEBHOOK_SECRET=your_webhook_secret
RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Optional
TOKEN_WHITELIST_MINTS=mint1,mint2,mint3
QUICKNODE_RPC_URL=https://solana-mainnet.quicknode.pro/your-key/
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
PORT=3000
```

## Recommendation

- **Use Express server** (`Option 2`) for most deployments
- **Use Next.js API route** (`Option 1`) only if you already have a Next.js application

The Express implementation is more portable and doesn't require Next.js dependencies.