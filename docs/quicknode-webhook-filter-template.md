# QuickNode Webhook Filter Template

This document provides server-side filter templates for configuring QuickNode webhook subscriptions to capture Raydium pool initialization events.

## Recommended Server-Side Filters

Configure your QuickNode webhook subscription with these filters to reduce noise and capture only relevant Raydium Initialize2 events:

### Program ID Filter

Filter transactions that interact with Raydium programs:

```json
{
  "programId": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
}
```

### Account Filter (Factory Addresses)

Filter transactions that involve Raydium factory accounts:

```json
{
  "accounts": [
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
  ]
}
```

### Instruction Name Filter

Filter for specific Raydium instructions:

```json
{
  "instructionName": "Initialize2"
}
```

### Combined Filter Example

Combine multiple filters for optimal event capture:

```json
{
  "filter": {
    "and": [
      {
        "programId": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
      },
      {
        "or": [
          {
            "instructionName": "Initialize2"
          },
          {
            "logs": {
              "contains": "Initialize2"
            }
          }
        ]
      }
    ]
  }
}
```

## Environment Configuration

Configure your webhook handler with these environment variables:

### Required Configuration

```bash
# Raydium program IDs (comma-separated list)
RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Raydium factory addresses (comma-separated list)  
RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# QuickNode webhook HMAC secret for signature verification
QUICKNODE_WEBHOOK_SECRET=your_webhook_secret_here

# Solana RPC endpoint for on-chain liquidity probes
QUICKNODE_RPC_URL=https://solana-mainnet.quicknode.pro/your-key/
```

### Optional Configuration

```bash
# Token whitelist (comma-separated mints, leave empty to allow all)
TOKEN_WHITELIST_MINTS=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Upstash Redis for deduplication (fallback to in-memory if not set)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Legacy token-based auth (use QUICKNODE_WEBHOOK_SECRET instead)
QN_WEBHOOK_TOKEN=your_legacy_token

# Allow unsigned webhooks (development only)
QN_ALLOW_UNSIGNED=0
```

## Webhook Payload Structure

Expected payload structure from QuickNode:

```json
{
  "transactions": [
    {
      "signature": "transaction_signature_here",
      "transaction": {
        "message": {
          "accountKeys": [
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
            "other_account_keys..."
          ]
        }
      },
      "meta": {
        "logMessages": [
          "Program log: Initialize2",
          "other log messages..."
        ]
      }
    }
  ]
}
```

## Security Considerations

### HMAC Signature Verification

Enable HMAC signature verification for production:

1. Set `QUICKNODE_WEBHOOK_SECRET` environment variable
2. QuickNode will send `x-quicknode-signature` header with HMAC-SHA256 signature
3. Webhook handler will verify signature before processing

### Whitelist Filters

Apply multiple layers of filtering:

1. **Server-side filters** (QuickNode): Reduce network traffic and processing load
2. **Program ID whitelist**: Only allow known Raydium programs  
3. **Factory address whitelist**: Only allow transactions involving known factories
4. **Token whitelist**: Optionally restrict to specific token mints

### Rate Limiting

Consider implementing additional rate limiting:

- Redis-based deduplication (1-hour windows)
- Connection pooling for on-chain probes
- Async processing to maintain webhook response times < 2s

## Testing Configuration

For testing and development:

```bash
# Allow unsigned webhooks (disable signature verification)
QN_ALLOW_UNSIGNED=1

# Use broader filters for testing
RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
# Leave TOKEN_WHITELIST_MINTS empty to allow all tokens
```

## Monitoring

The webhook handler provides metrics in the response:

```json
{
  "ok": true,
  "received": true,
  "txs": 5,
  "matches": 3,
  "accepted": 2,
  "ignored": 1,
  "duplicates": 0,
  "ms": 45
}
```

Monitor these metrics to tune your filters and ensure optimal performance.

## Deployment Checklist

1. ✅ Configure environment variables in production
2. ✅ Set up QuickNode webhook with server-side filters
3. ✅ Enable HMAC signature verification
4. ✅ Configure Redis for deduplication (recommended for production)
5. ✅ Test webhook with QuickNode test events
6. ✅ Monitor accepted/ignored ratios and adjust filters as needed
7. ✅ Set up logging and alerting for webhook processing errors