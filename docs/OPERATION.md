# Operation Guide

This guide covers how to operate the Firefly listener with the new sampling, logging, and paper trading features.

## Environment Configuration

### Sampling Configuration

Control event processing with deterministic sampling:

```bash
# Sample rate (0.0 to 1.0, default: 0.05 = 5%)
SAMPLE_RATE=0.05

# What to sample by: 'poolAddress' or 'txHash' (default: poolAddress)  
SAMPLE_BY=poolAddress

# Filter specific Raydium factory addresses (comma-separated)
RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
```

### Paper Trading

Enable simulated trading instead of real trades:

```bash
# Enable paper trading mode (default: false)
PAPER_TRADING=true
```

### Logging

Configure structured JSON logging:

```bash
# Log level: debug, info, warn, error (default: info)
LOG_LEVEL=info
```

## Sampling Behavior

The sampling system uses deterministic SHA256-based hashing to ensure:

- **Deterministic**: Same identifier always produces same sampling decision
- **Uniform distribution**: Hash-based sampling provides even distribution across the identifier space
- **Configurable**: Adjust sample rate from 0% to 100%

### Sample Rates

- `SAMPLE_RATE=0`: No events processed (all filtered out)
- `SAMPLE_RATE=0.05`: 5% of events processed (default)
- `SAMPLE_RATE=0.5`: 50% of events processed
- `SAMPLE_RATE=1`: All events processed (no sampling)

### Sampling Identifiers

- `SAMPLE_BY=poolAddress`: Sample based on Raydium pool address (recommended)
- `SAMPLE_BY=txHash`: Sample based on transaction hash

## Paper Trading Sessions

When `PAPER_TRADING=true`, the system will:

1. Simulate all trades instead of executing them on-chain
2. Apply realistic slippage (0.5-2%) and fees (0.25%)
3. Log all trades with `trade.simulated` event type
4. Attach a unique `runId` to each trading session
5. Persist trades in memory for session duration

### Starting Paper Trading

```bash
# Set environment and start
export PAPER_TRADING=true
export SAMPLE_RATE=0.1  # Optional: increase sampling for testing
npm run dev:listener
```

## Log Analysis

All logs are structured JSON with standard fields:

### Standard Log Fields

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (info, warn, error, debug)
- `message`: Human-readable message
- `event`: Event type for filtering
- `module`: Source module name
- `runId`: Unique session/trade identifier
- `txHash`: Transaction hash (when applicable)
- `poolAddress`: Pool address (when applicable)
- `sample_decision`: 'sampled_in' or 'sampled_out'
- `latency_ms`: Processing time in milliseconds
- `metadata`: Additional structured data

### Key Event Types

- `webhook.received`: Incoming webhook event
- `webhook.sampled_in`: Event passed sampling filter
- `webhook.sampled_out`: Event rejected by sampling
- `webhook.processed`: Event successfully processed
- `webhook.error`: Processing error occurred
- `trade.simulated`: Paper trade executed
- `trade.persisted`: Trade saved to storage

### Filtering Logs by Event Type

```bash
# Show only sampling decisions
npm run start:listener | grep "sampled_"

# Show only trade events
npm run start:listener | grep "trade\."

# Show errors only
npm run start:listener | grep '"level":"error"'

# Filter by runId for specific session
npm run start:listener | grep '"runId":"abc-123-def"'
```

### Log Storage

Logs are output to stdout by default. For persistent storage:

```bash
# Save to file
npm run start:listener > firefly.log 2>&1

# Use log rotation with logrotate or similar
npm run start:listener | rotatelogs firefly-%Y%m%d.log 86400
```

## Monitoring and Debugging

### Check Sampling Statistics

Monitor sampling effectiveness:

```bash
# Count events by type
grep "webhook.received" firefly.log | wc -l
grep "webhook.sampled_in" firefly.log | wc -l  
grep "webhook.sampled_out" firefly.log | wc -l
```

### Monitor Trading Activity

```bash
# Paper trade count
grep "trade.simulated" firefly.log | wc -l

# Trade success rate
grep "trade.simulated" firefly.log | jq '.metadata.executedAmount' | awk '{sum+=$1} END {print "Avg:", sum/NR}'
```

### Performance Monitoring

```bash
# Average processing latency
grep "latency_ms" firefly.log | jq '.latency_ms' | awk '{sum+=$1} END {print "Avg latency:", sum/NR "ms"}'

# Error rate
grep '"level":"error"' firefly.log | wc -l
```

## Troubleshooting

### Common Issues

1. **No events sampled in**: Check `SAMPLE_RATE` isn't too low
2. **High memory usage**: Verify paper trading isn't accumulating too many trades
3. **Missing logs**: Confirm `LOG_LEVEL` is appropriate (try 'debug')
4. **Factory filter issues**: Check `RAYDIUM_FACTORY_ADDRESSES` format

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run dev:listener
```

### Test Sampling Distribution

Run sampling tests to verify deterministic behavior:

```bash
npm test tests/filters/sampling.test.ts
```