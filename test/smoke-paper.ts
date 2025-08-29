// Minimal smoke test: call onTick with a fake signal and print store contents.
// Run with: ts-node (or compile to JS and run with node)
// Adjust imports if your build output lives in lib/ vs src/
import 'ts-node/register';
import { onTick } from '../lib/paper/tick';
import * as positions from '../lib/store/positions';
import { kvGet, kvSet } from '../lib/store/volatile';

async function main() {
  // ensure clean state
  if ((positions as any).setOpenPositions) (positions as any).setOpenPositions([]);
  await kvSet('portfolio:cash', 120);

  const signal = {
    category: 'Raydium',
    symbol: 'TEST',
    mint: 'TESTMINT',
    priceUsd: 1.23,
    investmentUsd: 10,
    source: 'smoke',
  };

  console.log('Running onTick with signal:', signal);
  const res = await onTick(signal);
  console.log('onTick result:', res);

  const open = (positions as any).getOpenPositions ? (positions as any).getOpenPositions() : [];
  console.log('Open Positions after onTick:', open);

  const cash = await kvGet<number>('portfolio:cash');
  console.log('Cash now:', cash);
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
