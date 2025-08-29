export type Position = {
  id: string;
  chain?: string;
  name?: string;
  category?: string;
  narrative?: string | null;
  mcap?: number;
  volume?: number;
  investment?: number;
  pnlUSD?: number;
  taxUSD?: number;
  holders?: number;
  txCount?: { buy?: number; sell?: number };
  scores?: any;
  links?: any;
  entryPrice?: number;
  lastPrice?: number;
  qty?: number;
  openedAt?: number;
  closedAt?: number | undefined;
  status?: 'open' | 'closed';
  reason?: string;
  tags?: string[];
  mint?: string;
};

const openMap = new Map<string, Position>();
const closedMap = new Map<string, Position>();

function clonePos(p: Position): Position {
  return JSON.parse(JSON.stringify(p)) as Position;
}

export function openPosition(p: Position): Position {
  if (!p || !p.id) {
    throw new Error('Position must have an id');
  }

  const id = p.id;
  // Ensure status is open, but preserve existing openedAt if present
  const pos: Position = {
    ...p,
    status: 'open',
    openedAt: p.openedAt, // Keep existing value or undefined
    closedAt: undefined,
  };

  // If exists in closedMap, remove it
  if (closedMap.has(id)) {
    closedMap.delete(id);
  }

  openMap.set(id, pos);
  return clonePos(pos);
}

export function closePosition(id: string, reason?: string): Position | null {
  if (!id) return null;
  const curOpen = openMap.get(id);
  const curClosed = closedMap.get(id);
  const now = Date.now();

  if (curOpen) {
    const upd: Position = { ...curOpen, status: 'closed', closedAt: now, reason: reason || curOpen.reason || 'closed' };
    openMap.delete(id);
    closedMap.set(id, upd);
    return clonePos(upd);
  }

  if (curClosed) {
    // already closed; update reason/closedAt defensively
    const upd: Position = { ...curClosed, status: 'closed', closedAt: curClosed.closedAt || now, reason: reason || curClosed.reason || 'closed' };
    closedMap.set(id, upd);
    return clonePos(upd);
  }

  return null;
}

export function updatePosition(id: string, patch: Partial<Position>): Position | null {
  if (!id) return null;
  const inOpen = openMap.get(id);
  const inClosed = closedMap.get(id);

  if (!inOpen && !inClosed) return null;

  // Determine which map to update based on patch.status (if provided) or current status
  const targetStatus = patch.status || (inOpen ? inOpen.status : inClosed?.status);
  const now = Date.now();

  let base: Position | undefined = inOpen ?? inClosed;
  if (!base) return null;

  const merged: Position = {
    ...base,
    ...patch,
  } as Position;

  if (targetStatus === 'open') {
    // move to open
    merged.status = 'open';
    merged.openedAt = merged.openedAt || base.openedAt || now;
    merged.closedAt = undefined;
    closedMap.delete(id);
    openMap.set(id, merged);
  } else {
    // move to closed
    merged.status = 'closed';
    merged.closedAt = merged.closedAt || now;
    openMap.delete(id);
    closedMap.set(id, merged);
  }

  return clonePos(merged);
}

export function setOpenPositions(list: Position[]): void {
  openMap.clear();
  if (!Array.isArray(list)) return;
  for (const p of list) {
    if (!p || !p.id) continue;
    const pos: Position = { ...p, status: 'open', closedAt: undefined };
    openMap.set(p.id, pos);
    // Ensure it's removed from closedMap
    if (closedMap.has(p.id)) closedMap.delete(p.id);
  }
}

export function setClosedPositions(list: Position[]): void {
  closedMap.clear();
  if (!Array.isArray(list)) return;
  const now = Date.now();
  for (const p of list) {
    if (!p || !p.id) continue;
    const pos: Position = { ...p, status: 'closed', closedAt: p.closedAt || now, reason: p.reason || 'closed' };
    closedMap.set(p.id, pos);
    if (openMap.has(p.id)) openMap.delete(p.id);
  }
}

export function getPosition(id: string): Position | undefined {
  if (!id) return undefined;
  const o = openMap.get(id);
  if (o) return clonePos(o);
  const c = closedMap.get(id);
  if (c) return clonePos(c);
  return undefined;
}

export function getOpenPositions(): Position[] {
  return Array.from(openMap.values()).map(clonePos);
}

export function getClosedPositions(): Position[] {
  return Array.from(closedMap.values()).map(clonePos);
}

export function listPositions(): Position[] {
  return [...getOpenPositions(), ...getClosedPositions()].sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));
}

