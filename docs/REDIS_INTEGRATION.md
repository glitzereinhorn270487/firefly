# Redis Integration

This document describes the Upstash Redis integration for persistent storage of paper trading positions and volatile key-value data.

## Overview

The Redis integration provides optional persistence for:
- Paper trading positions and portfolio data
- Bot settings and status
- Telegram notification settings
- Idempotency tracking
- Rule engine state
- Experimental data (liqlog)

## Configuration

Add these environment variables to enable Redis persistence:

```bash
# Upstash Redis configuration (optional)
UPSTASH_REDIS_REST_URL=https://your-redis-rest-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-rest-token
```

## Behavior

### When Redis is configured:
- All data is stored in Upstash Redis
- Data is also cached in-memory for performance
- On Redis failure, operations fall back to in-memory storage
- Warnings are logged for Redis failures

### When Redis is not configured:
- All data is stored in-memory only (existing behavior)
- No breaking changes to existing functionality
- Zero performance impact

## Architecture

The integration consists of:

1. **Redis Client** (`src/clients/redisClient.ts`)
   - Upstash REST API wrapper
   - Provides `redisGet`/`redisSet` functions
   - Handles authentication and error handling

2. **Redis Store Adapter** (`lib/store/redisStore.ts`)
   - Drop-in replacement for volatile store
   - Provides same `kvGet`/`kvSet` interface
   - Automatic fallback to in-memory storage

3. **Configuration** (`src/config/index.ts`)
   - Environment variable parsing
   - Type-safe configuration interface

## Migration

All existing code using `kvGet`/`kvSet` from `@/lib/store/volatile` has been updated to use `@/lib/store/redisStore` instead. The interface remains identical, ensuring zero breaking changes.

## Testing

To test the integration:

1. **Without Redis** (default):
   ```bash
   npm run build
   npm test
   ```

2. **With Redis** (requires valid Upstash credentials):
   ```bash
   export UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
   export UPSTASH_REDIS_REST_TOKEN="your-token"
   npm run build
   # Run your application - data will persist in Redis
   ```

## Benefits

- **Persistence**: Paper trading positions survive application restarts
- **Scalability**: Multiple instances can share the same Redis database
- **Backup**: Data is stored outside the application memory
- **Zero breaking changes**: Existing functionality unchanged when Redis not configured
- **Graceful degradation**: Automatic fallback on Redis failures