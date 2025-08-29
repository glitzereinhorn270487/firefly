type Tick = {
    mint?: string;
    symbol?: string;
    priceUsd?: number;
    volumeUsd1m?: number;
    volumeUsd5m?: number;
    txBuys1m?: number;
    txSells1m?: number;
    source?: string;
};
export declare function getEffectiveConfig(): {
    minVol1mUsd: any;
    minBuys1m: any;
    investUsd: any;
    stagnationMinutes: any;
    maxFirstBuyerSlots: any;
};
export declare function onWebhook(_evt: {
    source?: string;
    path?: string;
    payload?: any;
}): Promise<{
    ok: boolean;
}>;
/**
 * Process accepted webhook event in background
 * This function is called asynchronously by the webhook handler
 */
export declare function processAcceptedEvent(event: {
    source?: string;
    path?: string;
    payload?: any;
    poolAddress?: string;
    txHash?: string;
    timestamp?: number;
}): Promise<{
    ok: boolean;
    processed?: boolean;
    error?: string;
}>;
export declare function onTick(t: Tick): Promise<{
    ok: boolean;
    skipped: string;
    decision?: undefined;
} | {
    ok: boolean;
    decision: {
        ok: boolean;
        reason: string;
        noFollowers?: undefined;
    } | {
        ok: boolean;
        noFollowers: true;
        reason?: undefined;
    } | {
        ok: boolean;
        reason?: undefined;
        noFollowers?: undefined;
    };
    skipped?: undefined;
}>;
export declare function onManager(): Promise<{
    ok: boolean;
}>;
export default onTick;
//# sourceMappingURL=engine.d.ts.map