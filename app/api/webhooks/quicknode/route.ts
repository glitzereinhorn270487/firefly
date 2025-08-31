import { NextResponse } from "next/server";

function forbidden(msg: string = "Forbidden") {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  const token = req.headers.get("x-qn-token") ?? "";
  if (!token || token !== process.env.QN_WEBHOOK_TOKEN) {
    return forbidden("Invalid token");
  }

  try {
    const payload = await req.json();
    console.log("[QN event]", payload);

    // TODO: Filter Raydium creation events
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
}
