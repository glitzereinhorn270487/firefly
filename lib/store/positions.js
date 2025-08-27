"use strict";
// lib/store/positions.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPosition = openPosition;
exports.closePosition = closePosition;
exports.updatePosition = updatePosition;
exports.setOpenPositions = setOpenPositions;
exports.setClosedPositions = setClosedPositions;
exports.getPosition = getPosition;
exports.getOpenPositions = getOpenPositions;
exports.getClosedPositions = getClosedPositions;
exports.listPositions = listPositions;
const openMap = new Map();
const closedMap = new Map();
// --- CRUD / Mutations ---
function openPosition(p) {
    // sicherstellen, dass Status korrekt ist
    const pos = { ...p, status: 'open', closedAt: undefined, reason: p.reason };
    openMap.set(pos.id, pos);
    // falls es unter "closed" existierte, entfernen
    closedMap.delete(pos.id);
    return pos;
}
function closePosition(id, reason = 'closed') {
    const cur = openMap.get(id) ?? closedMap.get(id);
    if (!cur)
        return null;
    const upd = {
        ...cur,
        status: 'closed',
        reason,
        closedAt: Date.now(),
    };
    openMap.delete(id);
    closedMap.set(id, upd);
    return upd;
}
function updatePosition(id, patch) {
    const cur = openMap.get(id) ?? closedMap.get(id);
    if (!cur)
        return null;
    const next = { ...cur, ...patch };
    // in die richtige Map einsortieren
    if (next.status === 'open') {
        closedMap.delete(id);
        openMap.set(id, next);
    }
    else {
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
function setOpenPositions(list) {
    openMap.clear();
    for (const p of list) {
        // nur "open" zulassen; falls etwas anderes reinkommt, hart auf open setzen
        const pos = { ...p, status: 'open', closedAt: undefined };
        openMap.set(pos.id, pos);
        // doppelte Sicherheit: nicht auch unter closed führen
        closedMap.delete(pos.id);
    }
}
/**
 * Ersetzt die *geschlossenen* Positionen vollständig.
 * Offene bleiben unverändert.
 */
function setClosedPositions(list) {
    closedMap.clear();
    for (const p of list) {
        const pos = {
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
function getPosition(id) {
    return openMap.get(id) ?? closedMap.get(id);
}
function getOpenPositions() {
    return Array.from(openMap.values());
}
function getClosedPositions() {
    return Array.from(closedMap.values());
}
function listPositions() {
    return [...openMap.values(), ...closedMap.values()].sort((a, b) => b.openedAt - a.openedAt);
}
//# sourceMappingURL=positions.js.map