export default function AgentStatusBadge({ ok }: { ok: boolean }) {
  return (
    <span style={{ color: ok ? "green" : "red" }}>
      {ok ? "Running" : "Offline"}
    </span>
  );
}
