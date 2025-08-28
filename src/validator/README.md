# Raydium Deep-Fetcher

A conservative, opt-in module for performing minimal on-chain validation of Raydium candidates detected by the WebSocket listener.

## Features

- **Conservative approach**: Performs minimal, safe on-chain validation
- **Opt-in only**: Does not affect existing behavior unless explicitly enabled
- **Configurable**: Environment variables control behavior and thresholds
- **Timeout protection**: Prevents hanging on slow RPC calls
- **Concurrency control**: Limits simultaneous validations to avoid overwhelming RPC
- **Redis persistence**: Stores validation results for later analysis
- **Error resilient**: Gracefully handles and logs all failure modes

## Configuration

Environment variables (all optional with sensible defaults):

```bash
# Minimum liquidity threshold in USD (default: 50)
MIN_LIQUIDITY_USD=50

# Maximum concurrent validations (default: 5)  
VALIDATOR_CONCURRENCY=5

# Timeout for individual validations in milliseconds (default: 30000)
VALIDATOR_TIMEOUT_MS=30000

# RPC endpoint (falls back to QUICKNODE_RPC_URL, then RPC_URL)
QUICKNODE_RPC_URL=https://your-quicknode-endpoint.com
RPC_URL=https://api.mainnet-beta.solana.com

# Enable deep fetching (default: disabled)
ENABLE_RAYDIUM_DEEP_FETCH=true

# Redis configuration (for result persistence)
UPSTASH_REDIS_REST_URL=https://your-redis-url.com
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## Usage

### Basic Usage

```typescript
import { validateRaydiumCandidate, CandidateInput } from './src/validator/raydiumDeepFetcher';

const candidate: CandidateInput = {
  meta: {
    signature: 'transaction_signature_here',
    slot: 123456,
  },
  // ... other properties from raydium listener
};

const result = await validateRaydiumCandidate(candidate);

console.log('Validation result:', {
  status: result.status,           // 'validated', 'low-liquidity', 'fetch-failed', or 'invalid'
  reason: result.reason,           // Human-readable reason
  estimatedUsdValue: result.reserves?.estimatedUsdValue,
});
```

### Integration with Existing Raydium Listener

```typescript
import { startRaydiumListener } from './src/listener/raydiumListener';
import { enhancedCandidateHandler } from './src/validator/integration';

// Use the enhanced handler that optionally performs deep validation
startRaydiumListener(enhancedCandidateHandler);
```

### Custom Configuration

```typescript
import { RaydiumDeepFetcher } from './src/validator/raydiumDeepFetcher';

const customFetcher = new RaydiumDeepFetcher(
  10,    // concurrency limit
  60000, // timeout in ms
  100    // min liquidity USD
);

const result = await customFetcher.validateCandidate(candidate);
```

### Batch Processing

```typescript
import { validateRaydiumCandidates } from './src/validator/raydiumDeepFetcher';

const candidates = [/* array of candidates */];
const results = await validateRaydiumCandidates(candidates);

// Process results...
results.forEach(result => {
  if (result.status === 'validated') {
    console.log(`Validated: ${result.signature} (${result.reserves?.estimatedUsdValue} USD)`);
  }
});
```

## Validation Process

1. **Transaction Fetch**: Retrieves parsed transaction using `getParsedTransaction`
2. **Account Scanning**: Scans transaction account keys for potential pool/token accounts  
3. **Reserve Validation**: Fetches account info and extracts token amounts using decimals
4. **Liquidity Check**: Estimates USD value and compares to threshold
5. **Result Persistence**: Stores validation summary in Redis (if configured)

## Result Types

- `validated`: Candidate passed all checks and meets liquidity threshold
- `low-liquidity`: Valid but below minimum liquidity threshold  
- `fetch-failed`: Unable to fetch transaction or account data
- `invalid`: Transaction structure doesn't match expected patterns

## Safety Features

- **Non-destructive**: Only reads blockchain data, never modifies anything
- **Timeout protection**: All RPC calls have configurable timeouts
- **Error isolation**: Failures don't affect main application flow
- **Concurrency limits**: Prevents overwhelming RPC endpoints
- **Graceful degradation**: Works with partial data when possible

## Redis Storage

Validation results are stored with keys like:
```
raydium:validated:transaction_signature
```

Data includes:
- Validation status and reason
- Reserve amounts and estimated USD value  
- Timestamp
- Original signature and slot

## Testing

```bash
npm test tests/validator/raydiumDeepFetcher.test.ts
```

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `MIN_LIQUIDITY_USD` | 50 | Minimum liquidity threshold |
| `VALIDATOR_CONCURRENCY` | 5 | Max concurrent validations |
| `VALIDATOR_TIMEOUT_MS` | 30000 | Timeout per validation |
| `ENABLE_RAYDIUM_DEEP_FETCH` | false | Enable deep fetching |
| `QUICKNODE_RPC_URL` | - | Primary RPC endpoint |
| `RPC_URL` | mainnet-beta | Fallback RPC endpoint |

The module is designed to be completely safe and opt-in. It will not impact existing functionality unless explicitly enabled via `ENABLE_RAYDIUM_DEEP_FETCH=true`.