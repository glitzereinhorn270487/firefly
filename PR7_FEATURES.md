# PR7 Features: Enhanced Listener with Sampling, Logging, and Paper Trading

This PR introduces three major enhancements to the Firefly listener service:

## 🧪 Deterministic Sampling (`src/filters/sampling.ts`)

Provides consistent, deterministic sampling based on SHA-256 hashing to reduce system load while maintaining statistical validity.

### Features:
- **Deterministic**: Same identifier always produces the same sampling decision
- **Cryptographically Secure**: Uses SHA-256 for uniform distribution
- **Configurable**: Sample rates from 0 (never) to 1 (always)
- **Efficient**: First 6 bytes of hash for fast computation

### Usage:
```typescript
import { shouldSample } from './filters/sampling';

// Sample 30% of events deterministically
const shouldProcess = shouldSample(transactionSignature, 0.3);
```

### Environment Variables:
- `SAMPLE_RATE` (default: 1.0) - Controls global sampling rate

## 📝 Structured Logging (`src/logging/logger.ts`)

Pino-based structured logging with consistent JSON output and contextual information.

### Features:
- **Structured JSON**: All logs in machine-readable JSON format
- **Contextual Fields**: Automatic timestamp, module, runId, event fields
- **Multiple Levels**: info, warn, error, debug support
- **Environment Integration**: Automatic runId from `PAPER_RUN_ID`

### Usage:
```typescript
import { getLogger } from './logging/logger';

const logger = getLogger('my-module');
logger.info('order_placed', { orderId: 'abc123', amount: 100.50 });
logger.error('processing_failed', { error: 'Invalid input', requestId: 'req-456' });
```

### Environment Variables:
- `LOG_LEVEL` (default: 'info') - Controls log verbosity
- `PAPER_RUN_ID` (default: 'default-run') - Identifies the trading session

## 💰 Paper Trading (`src/trading/paperTrader.ts`)

Self-contained paper trading simulator for testing strategies without real money.

### Features:
- **Order Management**: Place buy/sell orders with validation
- **Position Tracking**: Track open positions and PnL
- **Risk Management**: Input validation and error handling
- **Integration Ready**: Works with existing portfolio infrastructure

### Usage:
```typescript
import { PaperTrader } from './trading/paperTrader';

const trader = new PaperTrader('my-run-123');

// Place a buy order
const result = await trader.placeOrder({
  side: 'buy',
  qty: 100,
  price: 1.50,
  symbol: 'TOKEN'
});

// Check positions
const positions = await trader.getPositions();
```

### Environment Variables:
- `PAPER_TRADER_ENABLED` (default: false) - Enables paper trading in listener
- `PAPER_RUN_ID` - Identifies the paper trading session

## 🚀 Enhanced Listener Integration

The main listener (`src/listener.ts`) now integrates all three features:

### New Capabilities:
- **Smart Sampling**: Reduces load by processing only sampled events
- **Rich Logging**: Detailed structured logs for monitoring and debugging  
- **Paper Trading**: Optional paper trades on detected events
- **Error Handling**: Comprehensive error logging and recovery

### Environment Variables:
```bash
# Existing
RPC_WSS=wss://your-quicknode-endpoint
WEBHOOK_URL=https://your-webhook-endpoint
WEBHOOK_AUTH=your-bearer-token
MAX_GETTX_PER_SEC=5

# New in PR7
SAMPLE_RATE=0.5              # Process 50% of events
PAPER_TRADER_ENABLED=true    # Enable paper trading
PAPER_RUN_ID=production-run-1
LOG_LEVEL=info
```

## 🧪 Testing

Run the comprehensive test suite:
```bash
# Build the project
npm run build

# Run manual tests
node tests/manual-test.mjs

# Run demonstration
node examples/demo.mjs
```

## 📊 Example Structured Logs

```json
{"level":"info","timestamp":"2025-08-27T19:10:38.325Z","pid":3699,"hostname":"server","event":"raydium_pool_initialize_detected","module":"listener","runId":"prod-run-1","signature":"5J7Zj...","slot":12345}

{"level":"info","timestamp":"2025-08-27T19:10:38.326Z","pid":3699,"hostname":"server","event":"paper_trade_executed","module":"listener","runId":"prod-run-1","signature":"5J7Zj...","result":{"id":"order-123","status":"filled"}}
```

## 🔧 Architecture

```
src/
├── filters/
│   └── sampling.ts      # Deterministic sampling logic
├── logging/
│   └── logger.ts        # Pino-based structured logging
├── trading/
│   └── paperTrader.ts   # Paper trading simulator
├── listener.ts          # Enhanced main listener
└── webhook_handler.ts   # Enhanced webhook receiver

tests/
└── manual-test.mjs      # Comprehensive tests

examples/
└── demo.mjs            # Feature demonstration
```

## ✅ Backwards Compatibility

All changes are backwards compatible:
- Existing environment variables continue to work
- New features are opt-in via environment variables
- Default behavior unchanged when new features disabled
- No breaking changes to APIs or interfaces

## 🎯 Performance Impact

- **Sampling**: Reduces processing load by configured percentage
- **Logging**: Minimal overhead with structured JSON format
- **Paper Trading**: Optional feature, disabled by default
- **Memory**: Self-contained, no external dependencies added