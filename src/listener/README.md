# Raydium WebSocket Listener

A minimal WebSocket listener for monitoring Raydium events on Solana using QuickNode's server-side filtering.

## Features

- **Efficient RPC Usage**: Uses QuickNode's `logsSubscribe` with `mentions` filter to receive only relevant logs
- **Automatic Reconnection**: Implements exponential backoff (1s to 30s max) for reliable connectivity
- **Redis Integration**: Optionally stores candidate events in Upstash Redis with 24h TTL
- **Configurable Filtering**: Monitor specific Raydium program IDs and factory addresses via environment variables
- **Graceful Error Handling**: Continues operation even if Redis is unavailable

## Environment Variables

```bash
# Required: QuickNode WebSocket URL
QUICKNODE_RPC_URL=wss://your-quicknode-endpoint

# Required: Comma-separated Raydium program IDs to monitor
RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Required: Comma-separated factory addresses to monitor  
RAYDIUM_FACTORY_ADDRESSES=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Optional: RPC commitment level (default: confirmed)
RPC_COMMITMENT=confirmed

# Optional: Upstash Redis configuration for event storage
UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

## Usage

### Basic Usage

```typescript
import { startRaydiumListener, stopRaydiumListener } from './src/listener/raydiumListener';

// Start the listener
await startRaydiumListener();

// Stop the listener
stopRaydiumListener();
```

### With Custom Event Handler

```typescript
import { startRaydiumListener } from './src/listener/raydiumListener';

const handleCandidate = async (candidate) => {
  console.log('New Raydium event detected:', candidate.meta.signature);
  // Process the candidate event
};

await startRaydiumListener(handleCandidate);
```

### Run Example

```bash
# Set your environment variables first
export QUICKNODE_RPC_URL=wss://your-endpoint
export RAYDIUM_PROGRAM_IDS=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Run the example
npm run dev:raydium-example
```

## Event Format

Candidate events have the following structure:

```typescript
{
  time: number;           // Unix timestamp when detected
  logs: string[];         // Array of log messages from the transaction
  meta: {
    slot: number;         // Blockchain slot number
    signature: string;    // Transaction signature
  }
}
```

## Redis Storage

When Redis is configured, events are stored with:
- **Key**: `raydium:candidate:{timestamp}`
- **Value**: JSON-serialized candidate object
- **TTL**: 24 hours (86400 seconds)

Redis failures are logged as warnings but don't interrupt the listener operation.

## Technical Details

- Uses WebSocket's `logsSubscribe` RPC method with QuickNode's `mentions` filter
- Automatically converts HTTP(S) URLs to WebSocket (WS/WSS) format
- Implements exponential backoff reconnection (1s → 2s → 4s → ... → 30s max)
- Matches log content against configured program IDs and factory addresses
- Thread-safe start/stop operations