// lib/store/positions.ts

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

// --- CRUD / Mutations ---

export function openPosition(p: Position): Position {
  // sicherstellen, dass Status korrekt ist
  const pos: Position = { ...p, status: 'open', closedAt: undefined };
  openMap.set(pos.id, pos);
  // falls es unter "closed" existierte, entfernen
  closedMap.delete(pos.id);
  return pos;
}

export function closePosition(id: string, reason = 'closed'): Position | null {
  const cur = openMap.get(id) ?? closedMap.get(id);
  if (!cur) return null;

  const upd: Position = {
    ...cur,
    status: 'closed',
    reason,
    closedAt: Date.now(),
  };

  openMap.delete(id);
  closedMap.set(id, upd);
  return upd;
}

export function updatePosition(id: string, patch: Partial<Position>): Position | null {
  const cur = openMap.get(id) ?? closedMap.get(id);
  if (!cur) return null;

  const next: Position = { ...cur, ...patch };

  // in die richtige Map einsortieren
  if (next.status === 'open') {
    closedMap.delete(id);
    openMap.set(id, next);
  } else {
    openMap.delete(id);
    closedMap.set(id, next);
  }
  return next;
}

// --- Setter, die von deinem bestehenden Code erwartet werden ---

/**
 * Ersetzt die *offenen* Positionen vollständig.
 * Geschlossene bleiben unverändert.
 */
export function setOpenPositions(list: Position[]): void {
  openMap.clear();
  for (const p of list) {
    // nur "open" zulassen; falls etwas anderes reinkommt, hart auf open setzen
    const pos: Position = { ...p, status: 'open', closedAt: undefined };
    openMap.set(pos.id, pos);
    // doppelte Sicherheit: nicht auch unter closed führen
    closedMap.delete(pos.id);
  }
}

/**
 * Ersetzt die *geschlossenen* Positionen vollständig.
 * Offene bleiben unverändert.
 */
export function setClosedPositions(list: Position[]): void {
  closedMap.clear();
  for (const p of list) {
    const pos: Position = {
      ...p,
      status: 'closed',
      closedAt: p.closedAt ?? Date.now(),
      reason: p.reason ?? 'closed',
    };
    closedMap.set(pos.id, pos);
    openMap.delete(pos.id);
  }
}

// --- Getter / Queries ---

export function getPosition(id: string): Position | undefined {
  return openMap.get(id) ?? closedMap.get(id);
}

export function getOpenPositions(): Position[] {
  return Array.from(openMap.values());
}

export function getClosedPositions(): Position[] {
  return Array.from(closedMap.values());
}

export function listPositions(): Position[] {
  return [...openMap.values(), ...closedMap.values()].sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));
}

