export type Chain = 'SOL';
export type Category = 'Raydium' | 'PumpFun' | 'Test';
export type Status = 'open' | 'closed';
export type Position = {
    id: string;
    chain: Chain;
    name: string;
    category: Category;
    marketcap?: number;
    volume?: number;
    investmentUsd: number;
    entryPriceUsd?: number;
    currentPriceUsd?: number;
    pnlUsd?: number;
    tax?: number;
    openedAt: number;
    closedAt?: number;
    status: Status;
    reason?: string;
    meta?: Record<string, any>;
    holders?: number;
    txCount?: {
        buy: number;
        sell: number;
    };
    scores?: {
        scorex: number;
        risk: number;
        fomo: number;
        pumpDumpProb: number;
    };
    links?: {
        telegram?: string;
        dexscreener?: string;
    };
    mint?: string;
};
export declare function openPosition(p: Position): Position;
export declare function closePosition(id: string, reason?: string): Position | null;
export declare function updatePosition(id: string, patch: Partial<Position>): Position | null;
/**
 * Ersetzt die *offenen* Positionen vollständig.
 * Geschlossene bleiben unverändert.
 */
export declare function setOpenPositions(list: Position[]): void;
/**
 * Ersetzt die *geschlossenen* Positionen vollständig.
 * Offene bleiben unverändert.
 */
export declare function setClosedPositions(list: Position[]): void;
export declare function getPosition(id: string): Position | undefined;
export declare function getOpenPositions(): Position[];
export declare function getClosedPositions(): Position[];
export declare function listPositions(): Position[];
//# sourceMappingURL=positions.d.ts.map