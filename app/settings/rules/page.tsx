import * as Rules from "@/src/rules";
import { RuleCard } from "@/components/RuleCard";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const list = Rules.Registry.all();

  return (
    <main style={{
      maxWidth: 900,
      margin: "40px auto",
      padding: "0 16px",
      color: "#e5e7eb",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Rules</h1>
      <p style={{ color: "#a1a1aa" }}>
        Demo-Registry. Neue Regeln unter <code>src/rules</code> hinzufügen.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {list.map(r => (
          <RuleCard key={r.id} id={r.id} name={r.name} description={r.description} />
        ))}
      </div>
    </main>
  );
}
