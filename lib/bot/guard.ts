import { kvGet } from '@/lib/store/redisStore';

type BotStatus = { status: 'OFF'|'PAPER'|'LIVE'; level: 'low'|'mid'|'high' };
const KEY = 'bot:status';

// Pfade, die Credits kosten könnten (Streams/Jobs/Provider)
const CREDIT_HEAVY_PREFIXES = ['/api/streams', '/api/jobs', '/api/providers', '/api/exchange'];

// Pfad, der im OFF weiterlaufen darf (Positions-Manager soll auslaufen)
function isAllowedWhileOff(pathname: string) {
  return pathname.startsWith('/api/positions/manager');
}
function isCreditHeavy(pathname: string) {
  return CREDIT_HEAVY_PREFIXES.some(p => pathname.startsWith(p));
}

// in jedem „teuren“ Handler aufrufen:
export async function gate(req: Request): Promise<{ allowed: boolean; reason?: string }> {
  const { pathname } = new URL(req.url);
  const s = await kvGet<BotStatus>(KEY);
  const isOff = !s || s.status === 'OFF';
  if (!isOff) return { allowed: true };
  if (isAllowedWhileOff(pathname)) return { allowed: true };
  if (isCreditHeavy(pathname)) return { allowed: false, reason: 'BOT_OFF' };
  return { allowed: true };
}
