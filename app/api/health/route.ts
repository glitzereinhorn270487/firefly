import { NextResponse } from "next/server";

export async function GET() {
  // super-simpler Health-Check; erweitere bei Bedarf (DB, Redis, etc.)
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    env: process.env.NODE_ENV,
  });
}
