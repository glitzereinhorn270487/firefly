import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.QN_WEBHOOK_TOKEN) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await req.json();
    console.log("QN event:", payload);

    // TODO: Später an Rules/Trading-Logic weiterleiten
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
}
