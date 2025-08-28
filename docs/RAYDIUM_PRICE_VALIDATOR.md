# Raydium Price Validator

The Raydium Price Validator is a conservative USD value estimation service for Raydium pool reserves. It provides opt-in, non-destructive filtering to remove low-USD-value pools after the deep-fetcher phase.

## Overview

This module helps filter out pools below a minimum USD threshold, reducing noise and focusing on higher-value trading opportunities. The validator is designed to be conservative in its estimates to avoid false positives.

## Features

- **Conservative Estimation**: Applies configurable conservative factors (default 0.8x) to reduce overestimation
- **Multiple Price Sources**: Uses DexScreener API for token prices and multiple sources for SOL prices
- **Error Handling**: Gracefully handles API failures and timeouts
- **Fallback Options**: Optional fallback pricing for unknown tokens
- **Batch Processing**: Efficiently processes multiple pool candidates
- **TypeScript Support**: Full type safety with comprehensive interfaces

## Usage

### Basic Estimation

```typescript
import { estimateReservesUSD, ReserveInfo } from './raydiumPriceValidator';

const reserves: ReserveInfo[] = [
  {
    mint: 'So11111111111111111111111111111111111111112', // SOL
    amount: '5000000000', // 5 SOL (9 decimals)
    decimals: 9
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC example
    amount: '1000000000000', // 1000 tokens (9 decimals)
    decimals: 9
  }
];

const result = await estimateReservesUSD(reserves);
console.log(`Total USD value: $${result.totalUsd}`);
console.log(`Has valid data: ${result.hasValidData}`);
```

### Filtering Pool Candidates

```typescript
import { filterByMinimumValue } from './raydiumPriceValidator';

const candidates = [
  { id: 'pool1', reserves: [...] },
  { id: 'pool2', reserves: [...] },
  // ... more candidates
];

// Filter to only include pools with >= $1000 USD value
const filtered = await filterByMinimumValue(candidates, 1000);
console.log(`Filtered ${candidates.length} down to ${filtered.length} candidates`);
```

### Custom Options

```typescript
import { estimateReservesUSD, PriceEstimateOptions } from './raydiumPriceValidator';

const options: PriceEstimateOptions = {
  conservativeFactor: 0.7, // Even more conservative
  timeoutMs: 3000, // 3 second timeout
  fallbackToSol: true // Enable fallback pricing
};

const result = await estimateReservesUSD(reserves, options);
```

## API Reference

### Types

#### `ReserveInfo`
```typescript
interface ReserveInfo {
  mint: string;           // Token mint address
  amount: string | number; // Reserve amount in native units
  decimals?: number;      // Token decimals (default: 9)
}
```

#### `PriceEstimateOptions`
```typescript
interface PriceEstimateOptions {
  conservativeFactor?: number; // Multiplier for estimates (default: 0.8)
  timeoutMs?: number;         // API timeout (default: 5000)
  fallbackToSol?: boolean;    // Use SOL fallback for unknown tokens (default: false)
}
```

#### `ReserveEstimateResult`
```typescript
interface ReserveEstimateResult {
  totalUsd: number;       // Total estimated USD value
  reserves: Array<{       // Individual reserve estimates
    mint: string;
    amountUi: number;     // UI amount (after decimals)
    priceUsd: number | null;
    valueUsd: number;
    source: 'dexscreener' | 'sol' | 'fallback' | 'unknown';
  }>;
  hasValidData: boolean;  // Whether any reserves had valid pricing
  timestamp: number;      // Estimation timestamp
}
```

### Functions

#### `estimateReservesUSD(reserves, options?)`
Estimates the total USD value of pool reserves.

**Parameters:**
- `reserves`: Array of ReserveInfo objects
- `options`: Optional estimation configuration

**Returns:** Promise\<ReserveEstimateResult\>

#### `meetsMinimumValue(reserves, minUsd?, options?)`
Checks if reserves meet a minimum USD threshold.

**Parameters:**
- `reserves`: Array of ReserveInfo objects
- `minUsd`: Minimum USD threshold (default: 1000)
- `options`: Optional estimation configuration

**Returns:** Promise\<boolean\>

#### `filterByMinimumValue(candidates, minUsd?, options?)`
Filters pool candidates by minimum USD value.

**Parameters:**
- `candidates`: Array of objects with optional `reserves` property
- `minUsd`: Minimum USD threshold (default: 1000)
- `options`: Optional estimation configuration

**Returns:** Promise\<T[]\> (filtered array)

## Price Sources

1. **SOL Prices**: Jupiter AG API (primary) → CoinGecko API (fallback)
2. **Token Prices**: DexScreener API
3. **Fallback**: Optional conservative SOL-based pricing (0.1% of SOL price)

## Conservative Approach

The validator applies several conservative measures:

- **Default 0.8x multiplier** on all estimates
- **Timeout protection** (5 second default)
- **Error handling** that excludes rather than estimates on failure
- **Fallback pricing** that assumes very low value (0.1% of SOL)
- **Minimum thresholds** to filter out dust/low-value pools

## Error Handling

The validator handles errors gracefully:

- API failures result in `null` prices and `unknown` source
- Timeouts are handled with Promise.race
- Invalid data is marked as unknown
- Batch processing continues even if individual candidates fail

## Integration Example

```typescript
// Example integration with existing pipeline
async function processPools(rawCandidates: any[]) {
  // Convert to our format
  const candidates = rawCandidates.map(candidate => ({
    ...candidate,
    reserves: extractReserves(candidate) // Your extraction logic
  }));
  
  // Filter by minimum value
  const filtered = await filterByMinimumValue(candidates, 1000);
  
  // Log results
  console.log(`Filtered ${rawCandidates.length} candidates to ${filtered.length}`);
  
  return filtered;
}
```

## Performance Considerations

- **Caching**: SOL price is cached for 60 seconds
- **Timeouts**: Configurable timeouts prevent hanging requests
- **Batch Processing**: Concurrent processing of multiple candidates
- **Conservative**: Fails fast rather than hanging on errors

## Testing

The module includes comprehensive tests covering:
- Valid reserve estimation
- Error handling scenarios
- Timeout behavior
- Fallback pricing
- Batch processing
- Edge cases and invalid data

Run tests with:
```bash
npm test -- tests/listener/raydiumPriceValidator.test.ts
```