import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    positions: [],
    message: "Paper positions stub"
  });
}
