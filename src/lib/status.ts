export type Health = { ok: boolean; ts: number; env?: string };

export async function fetchHealth(base = ""): Promise<Health> {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("health not ok");
    return (await res.json()) as Health;
  } catch {
    return { ok: false, ts: Date.now() };
  }
}
