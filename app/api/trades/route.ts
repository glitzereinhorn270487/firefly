import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    trades: [],
    pnl: 0,
    message: "Trade history stub"
  });
}
