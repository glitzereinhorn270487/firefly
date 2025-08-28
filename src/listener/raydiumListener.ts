import WebSocket from 'ws';
import { redisSet } from '../clients/redisClient';

// Environment configuration
const RPC_URL = process.env.QUICKNODE_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RAYDIUM_PROGRAM_IDS = (process.env.RAYDIUM_PROGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const RAYDIUM_FACTORY_ADDRESSES = (process.env.RAYDIUM_FACTORY_ADDRESSES || '').split(',').map(s => s.trim()).filter(Boolean);
const COMMITMENT = (process.env.RPC_COMMITMENT as any) || 'confirmed';

// Build a WebSocket URL by switching protocol
function toWs(url: string) {
  if (url.startsWith('https://')) return url.replace('https://', 'wss://');
  if (url.startsWith('http://')) return url.replace('http://', 'ws://');
  return url;
}

let socket: WebSocket | null = null;
let shouldStop = false;

export async function startRaydiumListener(onCandidate?: (payload: any) => Promise<void> | void) {
  shouldStop = false;
  const wsUrl = toWs(RPC_URL);
  let id = 1;
  let backoff = 1000; // ms

  function connect() {
    socket = new WebSocket(wsUrl);

    socket.on('open', () => {
      backoff = 1000;
      // Build mentions array: program ids + factory addresses
      const mentions = [...RAYDIUM_PROGRAM_IDS, ...RAYDIUM_FACTORY_ADDRESSES];
      const params: any = [{ mentions }, { commitment: COMMITMENT }];
      const payload = { jsonrpc: '2.0', id: id++, method: 'logsSubscribe', params };
      socket?.send(JSON.stringify(payload));
      console.info('[raydium-listener] connected, subscribed with mentions=', mentions);
    });

    socket.on('message', async (data: WebSocket.Data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
        // Handle subscription notifications
        if (msg.method === 'logsNotification' || (msg.params && msg.params.result && msg.params.type === 'logs')) {
          const result = msg.params?.result || msg.result;
          const logs = result?.value?.logs || [];
          // basic heuristic: if logs contain any factory address or program id mention, treat as candidate
          const joined = logs.join('\n');
          const mentions = [...RAYDIUM_PROGRAM_IDS, ...RAYDIUM_FACTORY_ADDRESSES];
          const matched = mentions.some(m => m && joined.includes(m));
          if (matched) {
            const candidate = { time: Date.now(), logs: logs, meta: { slot: result?.context?.slot, signature: result?.value?.signature } };
            console.info('[raydium-listener] candidate detected', candidate.meta);
            // persist a lightweight record to Redis (if configured)
            try {
              await redisSet(`raydium:candidate:${Date.now()}`, JSON.stringify(candidate), 60 * 60 * 24);
            } catch (e) {
              console.warn('[raydium-listener] redisSet failed', (e as Error).message);
            }
            if (onCandidate) await onCandidate(candidate);
          }
        }
      } catch (err) {
        console.warn('[raydium-listener] failed to parse message', (err as Error).message);
      }
    });

    socket.on('close', (code) => {
      console.warn('[raydium-listener] socket closed', code);
      socket = null;
      if (!shouldStop) {
        setTimeout(() => connect(), backoff);
        backoff = Math.min(backoff * 2, 30_000);
      }
    });

    socket.on('error', (err) => {
      console.warn('[raydium-listener] socket error', (err as Error).message);
      // socket will emit close afterwards
    });
  }

  connect();
}

export function stopRaydiumListener() {
  shouldStop = true;
  if (socket) {
    try { socket.close(); } catch (_) { /* ignore */ }
    socket = null;
  }
}