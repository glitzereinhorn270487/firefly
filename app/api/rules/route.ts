import { NextResponse } from "next/server";
import { sampleRules } from "@/src/rules";

export async function GET() {
  return NextResponse.json({ rules: sampleRules });
}
