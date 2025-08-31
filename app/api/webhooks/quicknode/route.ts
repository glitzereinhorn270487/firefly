import { NextRequest, NextResponse } from "next/server";

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("token") ?? "";
  const hv = req.headers.get("x-qn-token") ?? "";
  if (!qp || qp !== process.env.QN_WEBHOOK_TOKEN) return forbidden();
  if (!hv || hv !== process.env.QN_WEBHOOK_TOKEN) return forbidden();
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const qp = req.nextUrl.searchParams.get("token") ?? "";
    const hv = req.headers.get("x-qn-token") ?? "";
    if (!qp || qp !== process.env.QN_WEBHOOK_TOKEN) return forbidden();
    if (!hv || hv !== process.env.QN_WEBHOOK_TOKEN) return forbidden();

    const payload = await req.json();
    // Minimal-Filter: nur Raydium Pool-Creation Events weiterleiten/loggen
    // (Dein Webhook auf QuickNode filtert bereits serverseitig – hier nur no-op)
    console.log("QN event", JSON.stringify(payload));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
}
