import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    now: Date.now(),
    token: process.env.QN_WEBHOOK_TOKEN ? "set" : "missing",
  });
}
