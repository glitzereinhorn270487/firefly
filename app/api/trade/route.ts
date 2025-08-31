import { NextRequest, NextResponse } from "next/server";
import { runTradingEngine } from "@/src/engine/tradingEngine";
import { executePaperTrade } from "@/src/engine/paperTrader";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const decision = await runTradingEngine(body);

    // Simulate paper trade
    await executePaperTrade(decision, body.token || "unknown", body.price || 0);

    return NextResponse.json({ ok: true, decision });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
