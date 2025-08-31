import { fetchHealth } from "@/src/lib/status";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { AgentControls } from "@/components/AgentControls";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const health = await fetchHealth();
  const date = new Date(health.ts).toLocaleString();

  return (
    <main style={{
      maxWidth: 900,
      margin: "40px auto",
      padding: "0 16px",
      color: "#e5e7eb",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Firefly Dashboard</h1>

      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16
      }}>
        <div style={{ padding: 16, border: "1px solid #27272a", borderRadius: 14, background: "#0b0b0c" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Agent status</h2>
            <AgentStatusBadge ok={health.ok} />
          </div>
          <div style={{ fontSize: 14, color: "#a1a1aa" }}>
            last check: {date} · env: {health.env ?? "n/a"}
          </div>
        </div>

        <div style={{ padding: 16, border: "1px solid #27272a", borderRadius: 14, background: "#0b0b0c" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0 }}>Controls</h2>
          <AgentControls />
        </div>
      </section>
    </main>
  );
}
