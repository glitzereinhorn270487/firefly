import { NextResponse } from "next/server";
import * as Rules from "@/src/rules";

export async function GET() {
  // Import oben sorgt dafür, dass die Demo-Rule registriert ist
  const list = Rules.Registry.all().map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
  }));
  return NextResponse.json({ ok: true, rules: list });
}
